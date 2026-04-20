import type { WebhookV2, WebhookV2Event } from '@figma/rest-api-spec';
import { v4 as uuidv4 } from 'uuid';

import { InvalidInputUseCaseResultError } from './errors';
import type { OnDesignAssociatedWithIssueUseCaseParams } from './on-design-associated-with-issue-use-case';
import { onDesignAssociatedWithIssueUseCaseParams } from './on-design-associated-with-issue-use-case';

import * as launch_darkly from '../config/launch_darkly';
import {
	type AssociatedFigmaDesign,
	type FigmaFileWebhook,
	FigmaFileWebhookEventType,
} from '../domain/entities';
import {
	generateCloudId,
	generateFigmaDesignIdentifier,
	generateFigmaFileWebhook,
	generateJiraCallContext,
	generateJiraIssueAri,
	generateJiraIssueId,
} from '../domain/entities/testing';
import { figmaBackwardIntegrationServiceV2 } from '../infrastructure';
import { figmaService } from '../infrastructure/figma';
import {
	associatedFigmaDesignRepository,
	figmaFileWebhookRepository,
} from '../infrastructure/repositories';

const generateOnDesignAssociatedWithIssueUseCaseParams = ({
	designId = generateFigmaDesignIdentifier().toAtlassianDesignId(),
	issueId = generateJiraIssueId(),
	atlassianUserId = uuidv4(),
	cloudId = generateCloudId(),
} = {}): OnDesignAssociatedWithIssueUseCaseParams => ({
	design: {
		ari: 'NOT_USED',
		id: designId,
	},
	issue: {
		ari: generateJiraIssueAri({ issueId }),
		id: issueId,
	},
	atlassianUserId,
	jiraCallContext: generateJiraCallContext({ cloudId }),
});

const generateWebhookV2 = (
	fileKey: string,
	eventType: WebhookV2Event,
): WebhookV2 => ({
	id: uuidv4(),
	context: 'file',
	context_id: fileKey,
	event_type: eventType,
	team_id: '',
	status: 'ACTIVE',
	endpoint: 'https://figma-for-jira-test.com',
	passcode: uuidv4(),
	client_id: uuidv4(),
	plan_api_id: `organization:${uuidv4()}`,
	description: 'Figma for Jira Test Webhook',
});

describe('onDesignAssociatedWithIssueUseCase', () => {
	beforeEach(() => {
		// set getFeatureFlag to return true for all feature flags
		jest.spyOn(launch_darkly, 'getFeatureFlag').mockResolvedValue(true);
	});

	it('should store associated Design data, handle backward integration, and create file webhooks', async () => {
		const figmaDesignId = generateFigmaDesignIdentifier();
		const params = generateOnDesignAssociatedWithIssueUseCaseParams({
			designId: figmaDesignId.toAtlassianDesignId(),
		});
		jest
			.spyOn(associatedFigmaDesignRepository, 'upsert')
			.mockResolvedValue({} as AssociatedFigmaDesign);
		jest
			.spyOn(
				figmaBackwardIntegrationServiceV2,
				'tryCreateDevResourceForJiraIssue',
			)
			.mockResolvedValue();
		jest
			.spyOn(figmaFileWebhookRepository, 'findByFileKeyAndEventTypeAndCloudId')
			.mockResolvedValue(null);
		const fileWebhook = generateWebhookV2(figmaDesignId.fileKey, 'FILE_UPDATE');
		const devModeStatusUpdateWebhook = generateWebhookV2(
			figmaDesignId.fileKey,
			'DEV_MODE_STATUS_UPDATE',
		);
		const createWebhookForFileMock = jest
			.spyOn(figmaService, 'createWebhookForFile')
			.mockResolvedValueOnce(fileWebhook)
			.mockResolvedValueOnce(devModeStatusUpdateWebhook);
		jest
			.spyOn(figmaFileWebhookRepository, 'upsert')
			.mockResolvedValue({} as FigmaFileWebhook);

		await onDesignAssociatedWithIssueUseCaseParams.execute(params);

		expect(associatedFigmaDesignRepository.upsert).toHaveBeenCalledWith({
			designId: figmaDesignId,
			associatedWithAri: params.issue.ari,
			cloudId: params.jiraCallContext.cloudId,
			inputUrl: undefined,
		});
		expect(
			figmaBackwardIntegrationServiceV2.tryCreateDevResourceForJiraIssue,
		).toHaveBeenCalledWith({
			figmaDesignId,
			issueId: params.issue.id,
			atlassianUserId: params.atlassianUserId,
			jiraCallContext: params.jiraCallContext,
		});
		expect(
			figmaFileWebhookRepository.findByFileKeyAndEventTypeAndCloudId,
		).toHaveBeenCalledWith(
			figmaDesignId.fileKey,
			'FILE_UPDATE',
			params.jiraCallContext.cloudId,
		);
		expect(
			figmaFileWebhookRepository.findByFileKeyAndEventTypeAndCloudId,
		).toHaveBeenCalledWith(
			figmaDesignId.fileKey,
			'DEV_MODE_STATUS_UPDATE',
			params.jiraCallContext.cloudId,
		);
		expect(figmaService.createWebhookForFile).toHaveBeenCalledWith(
			figmaDesignId.fileKey,
			'FILE_UPDATE',
			expect.any(String),
			{
				cloudId: params.jiraCallContext.cloudId,
				atlassianUserId: params.atlassianUserId,
			},
		);
		expect(figmaService.createWebhookForFile).toHaveBeenCalledWith(
			figmaDesignId.fileKey,
			'DEV_MODE_STATUS_UPDATE',
			expect.any(String),
			{
				cloudId: params.jiraCallContext.cloudId,
				atlassianUserId: params.atlassianUserId,
			},
		);

		const passcode = createWebhookForFileMock.mock.calls[0][2];
		expect(figmaFileWebhookRepository.upsert).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				webhookId: fileWebhook.id,
				fileKey: figmaDesignId.fileKey,
				eventType: 'FILE_UPDATE',
				webhookPasscode: passcode,
				createdBy: {
					cloudId: params.jiraCallContext.cloudId,
					atlassianUserId: params.atlassianUserId,
				},
			}),
		);
		const secondPasscode = createWebhookForFileMock.mock.calls[1][2];
		expect(figmaFileWebhookRepository.upsert).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				webhookId: devModeStatusUpdateWebhook.id,
				fileKey: figmaDesignId.fileKey,
				eventType: 'DEV_MODE_STATUS_UPDATE',
				webhookPasscode: secondPasscode,
				createdBy: {
					cloudId: params.jiraCallContext.cloudId,
					atlassianUserId: params.atlassianUserId,
				},
			}),
		);
	});

	it('should not create new figma file webhooks if webhooks already exist on the file', async () => {
		const figmaDesignId = generateFigmaDesignIdentifier();
		const params = generateOnDesignAssociatedWithIssueUseCaseParams({
			designId: figmaDesignId.toAtlassianDesignId(),
		});
		jest
			.spyOn(associatedFigmaDesignRepository, 'upsert')
			.mockResolvedValue({} as AssociatedFigmaDesign);
		jest
			.spyOn(
				figmaBackwardIntegrationServiceV2,
				'tryCreateDevResourceForJiraIssue',
			)
			.mockResolvedValue();

		const fileWebhook = generateFigmaFileWebhook({
			fileKey: figmaDesignId.fileKey,
			createdBy: {
				cloudId: params.jiraCallContext.cloudId,
				atlassianUserId: params.atlassianUserId || uuidv4(),
			},
		});
		const devModeStatusUpdateWebhook = generateFigmaFileWebhook({
			fileKey: figmaDesignId.fileKey,
			createdBy: {
				cloudId: params.jiraCallContext.cloudId,
				atlassianUserId: params.atlassianUserId || uuidv4(),
			},
			eventType: FigmaFileWebhookEventType.DEV_MODE_STATUS_UPDATE,
		});
		jest
			.spyOn(figmaFileWebhookRepository, 'findByFileKeyAndEventTypeAndCloudId')
			.mockResolvedValueOnce(fileWebhook)
			.mockResolvedValueOnce(devModeStatusUpdateWebhook);
		jest.spyOn(figmaService, 'createWebhookForFile');
		jest.spyOn(figmaFileWebhookRepository, 'upsert');

		await onDesignAssociatedWithIssueUseCaseParams.execute(params);

		expect(
			figmaFileWebhookRepository.findByFileKeyAndEventTypeAndCloudId,
		).toHaveBeenCalledWith(
			figmaDesignId.fileKey,
			'FILE_UPDATE',
			params.jiraCallContext.cloudId,
		);
		expect(
			figmaFileWebhookRepository.findByFileKeyAndEventTypeAndCloudId,
		).toHaveBeenCalledWith(
			figmaDesignId.fileKey,
			'DEV_MODE_STATUS_UPDATE',
			params.jiraCallContext.cloudId,
		);
		expect(figmaService.createWebhookForFile).toHaveBeenCalledTimes(0);
		expect(figmaFileWebhookRepository.upsert).toHaveBeenCalledTimes(0);
	});

	it('should throw `InvalidInputUseCaseResultError` when design ID has unexpected format', async () => {
		const params = generateOnDesignAssociatedWithIssueUseCaseParams({
			designId: '',
		});

		await expect(
			onDesignAssociatedWithIssueUseCaseParams.execute(params),
		).rejects.toBeInstanceOf(InvalidInputUseCaseResultError);
	});
});
