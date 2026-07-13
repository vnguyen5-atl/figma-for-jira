import { jiraClient } from './jira-client';

import type { JiraCallContext, JiraIssue } from '../../domain/entities';
import { NotFoundHttpClientError } from '../http-client-errors';

export class JiraIssueService {
	/**
	 * Returns an Issue by the given ID or key.
	 *
	 * If the Issue does not exist or the app does not have permission to read it, return `null`.
	 */
	getIssue = async (
		issueIdOrKey: string,
		ctx: JiraCallContext,
	): Promise<JiraIssue | null> => {
		try {
			return await jiraClient.getIssue(issueIdOrKey, ctx);
		} catch (error) {
			if (error instanceof NotFoundHttpClientError) return null;

			throw error;
		}
	};
}

export const jiraIssueService = new JiraIssueService();
