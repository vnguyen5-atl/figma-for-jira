import { disconnectFigmaTeamUseCase } from './disconnect-figma-team-use-case';

import { generateCloudId, generateFigmaTeam } from '../domain/entities/testing';
import { figmaService } from '../infrastructure/figma';
import { ConfigurationState, jiraService } from '../infrastructure/jira';
import { figmaTeamRepository } from '../infrastructure/repositories';

describe('disconnectFigmaTeamUseCase', () => {
	it('should delete the webhook and FigmaTeam and set unconfigured app state', async () => {
		const cloudId = generateCloudId();
		const figmaTeam = generateFigmaTeam({
			cloudId: cloudId,
		});
		jest
			.spyOn(figmaTeamRepository, 'getByTeamIdAndCloudId')
			.mockResolvedValue(figmaTeam);
		jest.spyOn(figmaService, 'tryDeleteWebhook').mockResolvedValue();
		jest.spyOn(figmaTeamRepository, 'delete').mockResolvedValue(figmaTeam);
		jest.spyOn(figmaTeamRepository, 'findManyByCloudId').mockResolvedValue([]);
		jest
			.spyOn(jiraService, 'setAppConfigurationState')
			.mockResolvedValue(undefined);

		await disconnectFigmaTeamUseCase.execute(figmaTeam.teamId, cloudId);

		expect(figmaTeamRepository.getByTeamIdAndCloudId).toHaveBeenCalledWith(
			figmaTeam.teamId,
			figmaTeam.cloudId,
		);
		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledWith(
			figmaTeam.webhookId,
			figmaTeam.adminInfo,
		);
		expect(figmaTeamRepository.delete).toHaveBeenCalledWith(figmaTeam.id);
		expect(figmaTeamRepository.findManyByCloudId).toHaveBeenCalledWith(cloudId);
		expect(jiraService.setAppConfigurationState).toHaveBeenCalledWith(
			ConfigurationState.NOT_CONFIGURED,
			cloudId,
		);
	});

	it('should delete the webhook and FigmaTeam', async () => {
		const cloudId = generateCloudId();
		const figmaTeam = generateFigmaTeam({
			cloudId: cloudId,
		});
		jest
			.spyOn(figmaTeamRepository, 'getByTeamIdAndCloudId')
			.mockResolvedValue(figmaTeam);
		jest.spyOn(figmaService, 'tryDeleteWebhook').mockResolvedValue();
		jest.spyOn(figmaTeamRepository, 'delete').mockResolvedValue(figmaTeam);
		jest.spyOn(figmaTeamRepository, 'findManyByCloudId').mockResolvedValue([
			generateFigmaTeam({
				cloudId: cloudId,
			}),
		]);
		jest.spyOn(jiraService, 'setAppConfigurationState');

		await disconnectFigmaTeamUseCase.execute(figmaTeam.teamId, cloudId);

		expect(figmaTeamRepository.getByTeamIdAndCloudId).toHaveBeenCalledWith(
			figmaTeam.teamId,
			figmaTeam.cloudId,
		);
		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledWith(
			figmaTeam.webhookId,
			figmaTeam.adminInfo,
		);
		expect(figmaTeamRepository.delete).toHaveBeenCalledWith(figmaTeam.id);
		expect(figmaTeamRepository.findManyByCloudId).toHaveBeenCalledWith(cloudId);
		expect(jiraService.setAppConfigurationState).not.toHaveBeenCalled();
	});
});
