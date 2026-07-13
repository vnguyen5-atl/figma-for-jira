import type { JiraCallContext } from '../domain/entities';
import { figmaService } from '../infrastructure/figma';
import { jiraService } from '../infrastructure/jira';
import {
	figmaFileWebhookRepository,
	figmaTeamRepository,
} from '../infrastructure/repositories';
import { prismaClient } from '../infrastructure/repositories/prisma-client';

/**
 * @remarks
 * The implementation makes the best effort to remove application data but there is risk of:
 * - Data not being deleted from the database (e.g., in case of a database failure).
 * - Some Figma webhooks not being deleted (e.g., in case of a database or Figma API failure).
 *
 * Consider making the implementation idempotent and retrying its execution in case of a failure (e.g., using a queue).
 */
export const uninstalledUseCase = {
	execute: async (jiraCallContext: JiraCallContext) => {
		const { cloudId } = jiraCallContext;
		const figmaTeams = await figmaTeamRepository.findManyByCloudId(cloudId);

		await Promise.allSettled(
			figmaTeams.map((figmaTeam) =>
				figmaService.tryDeleteWebhook(figmaTeam.webhookId, figmaTeam.adminInfo),
			),
		);

		const figmaFileWebhooks =
			await figmaFileWebhookRepository.findManyByCloudId(cloudId);

		await Promise.allSettled(
			figmaFileWebhooks.map((figmaFileWebhook) =>
				figmaService.tryDeleteWebhook(
					figmaFileWebhook.webhookId,
					figmaFileWebhook.createdBy,
				),
			),
		);

		// Delete all data scoped to this cloudId. Without ConnectInstallation as a
		// cascade root, each table is now deleted explicitly.
		await prismaClient
			.get()
			.$transaction([
				prismaClient
					.get()
					.associatedFigmaDesign.deleteMany({ where: { cloudId } }),
				prismaClient
					.get()
					.figmaOAuth2UserCredentials.deleteMany({ where: { cloudId } }),
				prismaClient.get().figmaTeam.deleteMany({ where: { cloudId } }),
				prismaClient.get().figmaFileWebhook.deleteMany({ where: { cloudId } }),
				prismaClient.get().jiraAppToken.deleteMany({ where: { cloudId } }),
			]);

		// Delete the configuration state of the app since it is being uninstalled
		await jiraService.deleteAppConfigurationState(jiraCallContext);
	},
};
