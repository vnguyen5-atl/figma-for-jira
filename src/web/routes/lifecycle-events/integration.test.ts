import { HttpStatusCode } from 'axios';
import request from 'supertest';

import app from '../../../app';
import { buildAppUrl, getConfig } from '../../../config';
import {
	generateAssociatedFigmaDesign,
	generateCloudId,
	generateFigmaOAuth2UserCredentialCreateParams,
	generateFigmaTeam,
} from '../../../domain/entities/testing';
import {
	associatedFigmaDesignRepository,
	figmaOAuth2UserCredentialsRepository,
	figmaTeamRepository,
	jiraAppTokenRepository,
} from '../../../infrastructure/repositories';
import {
	mockFigmaDeleteWebhookEndpoint,
	mockForgeInvocationToken,
	mockJiraDeleteAppPropertyEndpoint,
} from '../../testing';

describe('/lifecycleEvents (Forge Remote)', () => {
	describe('POST /uninstalled', () => {
		it('should delete app data + Figma webhooks for the cloud being uninstalled', async () => {
			const cloudId = generateCloudId();
			const otherCloudId = generateCloudId();

			const [targetTeam, otherTeam] = await Promise.all([
				figmaTeamRepository.upsert(generateFigmaTeam({ cloudId })),
				figmaTeamRepository.upsert(
					generateFigmaTeam({ cloudId: otherCloudId }),
				),
			]);
			const [targetCreds] = await Promise.all([
				figmaOAuth2UserCredentialsRepository.upsert(
					generateFigmaOAuth2UserCredentialCreateParams({ cloudId }),
				),
				figmaOAuth2UserCredentialsRepository.upsert(
					generateFigmaOAuth2UserCredentialCreateParams({
						cloudId: otherCloudId,
					}),
				),
			]);
			const [, otherDesign] = await Promise.all([
				associatedFigmaDesignRepository.upsert(
					generateAssociatedFigmaDesign({ cloudId }),
				),
				associatedFigmaDesignRepository.upsert(
					generateAssociatedFigmaDesign({ cloudId: otherCloudId }),
				),
			]);

			const fit = await mockForgeInvocationToken({ cloudId });

			mockFigmaDeleteWebhookEndpoint({
				baseUrl: new URL(getConfig().figma.apiBaseUrl),
				webhookId: targetTeam.webhookId,
				accessToken: targetCreds.accessToken,
			});
			mockJiraDeleteAppPropertyEndpoint({
				baseUrl: fit.apiBaseUrl,
				propertyKey: 'is-configured',
			});

			await request(app)
				.post(buildAppUrl('lifecycleEvents/uninstalled').pathname)
				.set(fit.headers)
				.expect(HttpStatusCode.NoContent);

			// Target cloud's data is gone
			expect(
				await figmaTeamRepository.findByWebhookId(targetTeam.webhookId),
			).toBeNull();
			// Unrelated cloud's data is preserved
			expect(
				await figmaTeamRepository.findByWebhookId(otherTeam.webhookId),
			).not.toBeNull();
			expect(otherDesign).toBeDefined();
		});

		it('should respond 401 when no FIT is provided', async () => {
			await request(app)
				.post(buildAppUrl('lifecycleEvents/uninstalled').pathname)
				.expect(HttpStatusCode.Unauthorized);
		});
	});

	describe('POST /refresh-app-token', () => {
		it('should persist the latest app system token for the cloud', async () => {
			const cloudId = generateCloudId();
			const fit = await mockForgeInvocationToken({
				cloudId,
				appSystemToken: 'new-system-token-value',
			});

			await request(app)
				.post(buildAppUrl('lifecycleEvents/refresh-app-token').pathname)
				.set(fit.headers)
				.expect(HttpStatusCode.NoContent);

			const stored = await jiraAppTokenRepository.getJiraCallContext(cloudId);
			expect(stored.cloudId).toBe(cloudId);
			expect(stored.appSystemToken).toBe('new-system-token-value');
		});
	});
});
