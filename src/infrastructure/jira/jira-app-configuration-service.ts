import { jiraClient } from './jira-client';

import type { JiraCallContext } from '../../domain/entities';
import { NotFoundHttpClientError } from '../http-client-errors';

const APP_PROPERTY_KEY = 'is-configured';

export enum ConfigurationState {
	CONFIGURED = 'CONFIGURED',
	NOT_CONFIGURED = 'NOT_CONFIGURED',
}

export class JiraAppConfigurationService {
	setAppConfigurationState = async (
		configurationState: ConfigurationState,
		ctx: JiraCallContext,
	): Promise<void> => {
		return await jiraClient.setAppProperty(
			APP_PROPERTY_KEY,
			{ isConfigured: configurationState },
			ctx,
		);
	};

	deleteAppConfigurationState = async (
		ctx: JiraCallContext,
	): Promise<void> => {
		try {
			return await jiraClient.deleteAppProperty(APP_PROPERTY_KEY, ctx);
		} catch (error) {
			if (error instanceof NotFoundHttpClientError) {
				return; // Swallow not found errors
			}

			throw error;
		}
	};
}

export const jiraAppConfigurationService = new JiraAppConfigurationService();
