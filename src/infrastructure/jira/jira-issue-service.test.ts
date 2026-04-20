import { jiraClient } from './jira-client';
import { jiraService } from './jira-service';

import {
	generateCloudId,
	generateJiraIssue,
	generateJiraIssueKey,
} from '../../domain/entities/testing';
import { NotFoundHttpClientError } from '../http-client-errors';

describe('JiraIssueService', () => {
	describe('getIssue', () => {
		it('should return issue', async () => {
			const cloudId = generateCloudId();
			const jiraIssue = generateJiraIssue();
			jest.spyOn(jiraClient, 'getIssue').mockResolvedValue(jiraIssue);

			const result = await jiraService.getIssue(jiraIssue.key, cloudId);

			expect(result).toBe(jiraIssue);
			expect(jiraClient.getIssue).toHaveBeenCalledWith(jiraIssue.key, cloudId);
		});

		it('should return `null` when issue is not found', async () => {
			const cloudId = generateCloudId();
			const issueKey = generateJiraIssueKey();
			jest
				.spyOn(jiraClient, 'getIssue')
				.mockRejectedValue(new NotFoundHttpClientError());

			const result = await jiraService.getIssue(issueKey, cloudId);

			expect(result).toBeNull();
		});
	});
});
