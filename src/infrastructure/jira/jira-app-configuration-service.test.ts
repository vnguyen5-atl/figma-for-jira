import {
	ConfigurationState,
	jiraAppConfigurationService,
} from './jira-app-configuration-service';
import { jiraClient } from './jira-client';

import { generateCloudId } from '../../domain/entities/testing';
import {
	ForbiddenHttpClientError,
	NotFoundHttpClientError,
} from '../http-client-errors';

describe('JiraService', () => {
	describe('setAppConfigurationState', () => {
		it('should set configuration state in app properties', async () => {
			const configurationState = ConfigurationState.CONFIGURED;
			const cloudId = generateCloudId();
			jest.spyOn(jiraClient, 'setAppProperty').mockResolvedValue(undefined);

			await jiraAppConfigurationService.setAppConfigurationState(
				configurationState,
				cloudId,
			);

			expect(jiraClient.setAppProperty).toHaveBeenCalledWith(
				'is-configured',
				{ isConfigured: configurationState },
				cloudId,
			);
		});
	});

	describe('deleteAppConfigurationState', () => {
		let cloudId: string;

		beforeEach(() => {
			cloudId = generateCloudId();
		});

		it('should delete the configuration state in app properties', async () => {
			jest.spyOn(jiraClient, 'deleteAppProperty').mockResolvedValue(undefined);

			await jiraAppConfigurationService.deleteAppConfigurationState(cloudId);

			expect(jiraClient.deleteAppProperty).toHaveBeenCalledWith(
				'is-configured',
				cloudId,
			);
		});

		it('should not rethrow NotFoundHttpClientError errors', async () => {
			const notFoundError = new NotFoundHttpClientError();
			jest
				.spyOn(jiraClient, 'deleteAppProperty')
				.mockRejectedValue(notFoundError);

			await expect(
				jiraAppConfigurationService.deleteAppConfigurationState(cloudId),
			).resolves.not.toThrow(notFoundError);
		});

		it('should rethrow unexpected errors', async () => {
			const unexpectedError = new ForbiddenHttpClientError();
			jest
				.spyOn(jiraClient, 'deleteAppProperty')
				.mockRejectedValue(unexpectedError);

			await expect(
				jiraAppConfigurationService.deleteAppConfigurationState(cloudId),
			).rejects.toThrow(unexpectedError);
		});
	});
});
