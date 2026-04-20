import { v4 as uuidv4 } from 'uuid';

import { uninstalledUseCase } from './uninstalled-use-case';

import {
	generateCloudId,
	generateFigmaFileWebhook,
	generateFigmaTeam,
} from '../domain/entities/testing';
import { figmaService } from '../infrastructure/figma';
import { jiraService } from '../infrastructure/jira';
import {
	figmaFileWebhookRepository,
	figmaTeamRepository,
} from '../infrastructure/repositories';
import { prismaClient } from '../infrastructure/repositories/prisma-client';

describe('uninstalledUseCase', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should delete Figma webhooks and app data for the given cloudId', async () => {
		const cloudId = generateCloudId();
		const [figmaTeam1, figmaTeam2] = [
			generateFigmaTeam({ cloudId }),
			generateFigmaTeam({ cloudId }),
		];
		const [figmaFileWebhook1, figmaFileWebhook2] = [
			generateFigmaFileWebhook({
				createdBy: { cloudId, atlassianUserId: uuidv4() },
			}),
			generateFigmaFileWebhook({
				createdBy: { cloudId, atlassianUserId: uuidv4() },
			}),
		];
		jest
			.spyOn(figmaTeamRepository, 'findManyByCloudId')
			.mockResolvedValue([figmaTeam1, figmaTeam2]);
		jest
			.spyOn(figmaFileWebhookRepository, 'findManyByCloudId')
			.mockResolvedValue([figmaFileWebhook1, figmaFileWebhook2]);
		jest.spyOn(figmaService, 'tryDeleteWebhook').mockResolvedValue();

		// Mock the Prisma transaction (the use case calls prismaClient.get().$transaction([...]))
		const transactionSpy = jest
			.fn<Promise<unknown[]>, [unknown[]]>()
			.mockResolvedValue([]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
		jest.spyOn(prismaClient, 'get').mockReturnValue({
			$transaction: transactionSpy,
			associatedFigmaDesign: { deleteMany: jest.fn() },
			figmaOAuth2UserCredentials: { deleteMany: jest.fn() },
			figmaTeam: { deleteMany: jest.fn() },
			figmaFileWebhook: { deleteMany: jest.fn() },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		jest
			.spyOn(jiraService, 'deleteAppConfigurationState')
			.mockResolvedValue(undefined);

		await uninstalledUseCase.execute(cloudId);

		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledTimes(4);
		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledWith(
			figmaTeam1.webhookId,
			figmaTeam1.adminInfo,
		);
		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledWith(
			figmaTeam2.webhookId,
			figmaTeam2.adminInfo,
		);
		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledWith(
			figmaFileWebhook1.webhookId,
			figmaFileWebhook1.createdBy,
		);
		expect(figmaService.tryDeleteWebhook).toHaveBeenCalledWith(
			figmaFileWebhook2.webhookId,
			figmaFileWebhook2.createdBy,
		);
		expect(transactionSpy).toHaveBeenCalled();
		expect(jiraService.deleteAppConfigurationState).toHaveBeenCalledWith(
			cloudId,
		);
	});
});
