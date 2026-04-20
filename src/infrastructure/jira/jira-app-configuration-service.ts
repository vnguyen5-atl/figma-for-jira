import { jiraClient } from './jira-client';

import { NotFoundHttpClientError } from '../http-client-errors';

const APP_PROPERTY_KEY = 'is-configured';

export enum ConfigurationState {
	CONFIGURED = 'CONFIGURED',
	NOT_CONFIGURED = 'NOT_CONFIGURED',
}

export class JiraAppConfigurationService {
	setAppConfigurationState = async (
		configurationState: ConfigurationState,
		cloudId: string,
	): Promise<void> => {
		return await jiraClient.setAppProperty(
			APP_PROPERTY_KEY,
			{ isConfigured: configurationState },
			cloudId,
		);
	};

	deleteAppConfigurationState = async (cloudId: string): Promise<void> => {
		try {
			return await jiraClient.deleteAppProperty(APP_PROPERTY_KEY, cloudId);
		} catch (error) {
			if (error instanceof NotFoundHttpClientError) {
				return; // Swallow not found errors
			}

			throw error;
		}
	};
}

export const jiraAppConfigurationService = new JiraAppConfigurationService();
