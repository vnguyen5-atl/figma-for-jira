import {
	ConfigurationState,
	jiraAppConfigurationService,
} from './jira-app-configuration-service';
import { jiraClient } from './jira-client';

import type { JiraCallContext } from '../../domain/entities';
import { generateJiraCallContext } from '../../domain/entities/testing';
import {
	ForbiddenHttpClientError,
	NotFoundHttpClientError,
} from '../http-client-errors';

describe('JiraAppConfigurationService', () => {
	describe('setAppConfigurationState', () => {
		it('should set configuration state in app properties', async () => {
			const configurationState = ConfigurationState.CONFIGURED;
			const jiraCallContext = generateJiraCallContext();
			jest.spyOn(jiraClient, 'setAppProperty').mockResolvedValue(undefined);

			await jiraAppConfigurationService.setAppConfigurationState(
				configurationState,
				jiraCallContext,
			);

			expect(jiraClient.setAppProperty).toHaveBeenCalledWith(
				'is-configured',
				{ isConfigured: configurationState },
				jiraCallContext,
			);
		});
	});

	describe('deleteAppConfigurationState', () => {
		let jiraCallContext: JiraCallContext;

		beforeEach(() => {
			jiraCallContext = generateJiraCallContext();
		});

		it('should delete the configuration state in app properties', async () => {
			jest.spyOn(jiraClient, 'deleteAppProperty').mockResolvedValue(undefined);

			await jiraAppConfigurationService.deleteAppConfigurationState(
				jiraCallContext,
			);

			expect(jiraClient.deleteAppProperty).toHaveBeenCalledWith(
				'is-configured',
				jiraCallContext,
			);
		});

		it('should not rethrow NotFoundHttpClientError errors', async () => {
			const notFoundError = new NotFoundHttpClientError();
			jest
				.spyOn(jiraClient, 'deleteAppProperty')
				.mockRejectedValue(notFoundError);

			await expect(
				jiraAppConfigurationService.deleteAppConfigurationState(
					jiraCallContext,
				),
			).resolves.not.toThrow(notFoundError);
		});

		it('should rethrow unexpected errors', async () => {
			const unexpectedError = new ForbiddenHttpClientError();
			jest
				.spyOn(jiraClient, 'deleteAppProperty')
				.mockRejectedValue(unexpectedError);

			await expect(
				jiraAppConfigurationService.deleteAppConfigurationState(
					jiraCallContext,
				),
			).rejects.toThrow(unexpectedError);
		});
	});
});
