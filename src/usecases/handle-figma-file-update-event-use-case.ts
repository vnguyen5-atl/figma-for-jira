import { uniqueWith } from '../common/array-utils';
import { getFeatureFlag, getLDClient } from '../config/launch_darkly';
import type { AtlassianUserInfo, JiraCallContext } from '../domain/entities';
import { FigmaTeamAuthStatus } from '../domain/entities';
import { getLogger } from '../infrastructure';
import {
	figmaService,
	UnauthorizedFigmaServiceError,
} from '../infrastructure/figma';
import { jiraService } from '../infrastructure/jira';
import {
	associatedFigmaDesignRepository,
	figmaTeamRepository,
	jiraAppTokenRepository,
} from '../infrastructure/repositories';
import { NotFoundRepositoryError } from '../infrastructure/repositories/errors';
import type { FigmaWebhookInfo } from '../web/routes/figma';

export const handleFigmaFileUpdateEventUseCase = {
	execute: async (
		webhookInfo: FigmaWebhookInfo,
		fileKey: string,
	): Promise<void> => {
		switch (webhookInfo.webhookType) {
			case 'team': {
				const figmaTeam = webhookInfo.figmaTeam;
				try {
					const teamName = await figmaService.getTeamName(
						figmaTeam.teamId,
						figmaTeam.adminInfo,
					);
					await figmaTeamRepository.updateTeamName(figmaTeam.id, teamName);
				} catch (e: unknown) {
					if (e instanceof UnauthorizedFigmaServiceError) {
						return figmaTeamRepository.updateAuthStatus(
							figmaTeam.id,
							FigmaTeamAuthStatus.ERROR,
						);
					}

					getLogger().warn(e, `Failed to sync team name for ${figmaTeam.id}`);
				}

				try {
					await syncDesignsToJira(
						fileKey,
						figmaTeam.cloudId,
						figmaTeam.adminInfo,
					);
				} catch (e: unknown) {
					if (e instanceof UnauthorizedFigmaServiceError) {
						return figmaTeamRepository.updateAuthStatus(
							figmaTeam.id,
							FigmaTeamAuthStatus.ERROR,
						);
					}
					throw e;
				}

				return;
			}

			case 'file': {
				const ldClient = await getLDClient();
				const useFileWebhooks = await getFeatureFlag(
					ldClient,
					'ext_figma_for_jira_use_file_webhooks',
					false,
				);
				if (!useFileWebhooks) {
					return;
				}

				const figmaFileWebhook = webhookInfo.figmaFileWebhook;
				return await syncDesignsToJira(
					fileKey,
					figmaFileWebhook.createdBy.cloudId,
					figmaFileWebhook.createdBy,
				);
			}
		}
	},
};

async function syncDesignsToJira(
	fileKey: string,
	cloudId: string,
	adminInfo: AtlassianUserInfo,
): Promise<void> {
	const associatedFigmaDesigns =
		await associatedFigmaDesignRepository.findManyByFileKeyAndCloudId(
			fileKey,
			cloudId,
		);

	if (!associatedFigmaDesigns.length) return;

	const atlassianDesignIds = associatedFigmaDesigns.map((x) => x.designId);
	const uniqueDesignIds = uniqueWith(atlassianDesignIds, (x, y) => x.equal(y));

	const designs = await figmaService.getAvailableDesignsFromSameFile(
		uniqueDesignIds,
		adminInfo,
	);

	if (!designs.length) return;

	// Webhook flow has no inbound FIT, so hydrate JiraCallContext from the
	// persisted `jira_app_token` row (kept fresh by the Forge scheduledTrigger).
	let jiraCallContext: JiraCallContext;
	try {
		jiraCallContext =
			await jiraAppTokenRepository.getJiraCallContext(cloudId);
	} catch (e) {
		if (e instanceof NotFoundRepositoryError) {
			getLogger().warn(
				`No persisted Jira app token for cloudId ${cloudId}; cannot sync designs.`,
			);
			return;
		}
		throw e;
	}

	await jiraService.submitDesigns(designs, jiraCallContext);
}
