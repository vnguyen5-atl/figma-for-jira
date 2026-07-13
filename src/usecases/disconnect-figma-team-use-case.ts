import { ForbiddenByFigmaUseCaseResultError } from './errors';

import type { JiraCallContext } from '../domain/entities';
import {
	figmaService,
	UnauthorizedFigmaServiceError,
} from '../infrastructure/figma';
import { ConfigurationState, jiraService } from '../infrastructure/jira';
import { figmaTeamRepository } from '../infrastructure/repositories';

export const disconnectFigmaTeamUseCase = {
	/**
	 * @throws {ForbiddenByFigmaUseCaseResultError} Not authorized to access Figma.
	 */
	execute: async (teamId: string, jiraCallContext: JiraCallContext) => {
		const { cloudId } = jiraCallContext;
		try {
			const figmaTeam = await figmaTeamRepository.getByTeamIdAndCloudId(
				teamId,
				cloudId,
			);

			await figmaService.tryDeleteWebhook(
				figmaTeam.webhookId,
				figmaTeam.adminInfo,
			);

			await figmaTeamRepository.delete(figmaTeam.id);

			const configuredTeams =
				await figmaTeamRepository.findManyByCloudId(cloudId);

			if (configuredTeams.length === 0) {
				await jiraService.setAppConfigurationState(
					ConfigurationState.NOT_CONFIGURED,
					jiraCallContext,
				);
			}
		} catch (e) {
			if (e instanceof UnauthorizedFigmaServiceError) {
				throw new ForbiddenByFigmaUseCaseResultError(e);
			}

			throw e;
		}
	},
};
