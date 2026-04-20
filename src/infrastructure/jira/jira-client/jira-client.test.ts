import axios, { AxiosHeaders, HttpStatusCode } from 'axios';

import { jiraClient } from './jira-client';
import {
	generateCheckPermissionsRequest,
	generateCheckPermissionsResponse,
	generateGetIssueResponse,
	generateSubmitDesignsRequest,
	generateSuccessfulSubmitDesignsResponse,
} from './testing';
import type {
	CheckPermissionsRequest,
	CheckPermissionsResponse,
} from './types';

import { SchemaValidationError } from '../../../common/schema-validation';
import { generateCloudId } from '../../../domain/entities/testing';

describe('JiraClient', () => {
	let cloudId: string;

	const expectedJiraApiBaseUrl = (cloud: string) =>
		`https://api.atlassian.com/ex/jira/${cloud}/`;

	const defaultExpectedRequestHeaders = () => ({
		headers: new AxiosHeaders().setAuthorization(
			`Bearer FORGE_APP_TOKEN_PLACEHOLDER`,
		),
	});

	beforeEach(() => {
		cloudId = generateCloudId();
	});

	describe('submitDesigns', () => {
		it('should submit designs', async () => {
			const request = generateSubmitDesignsRequest();
			const response = generateSuccessfulSubmitDesignsResponse([
				request.designs[0].id,
			]);
			jest.spyOn(axios, 'post').mockResolvedValue({ data: response });

			const result = await jiraClient.submitDesigns(request, cloudId);

			expect(result).toBe(response);
			expect(axios.post).toHaveBeenCalledWith(
				`${expectedJiraApiBaseUrl(cloudId)}rest/designs/1.0/bulk`,
				request,
				defaultExpectedRequestHeaders(),
			);
		});

		it('should throw when response has invalid schema', async () => {
			const request = generateSubmitDesignsRequest();
			const unexpectedResponse = {
				...generateSuccessfulSubmitDesignsResponse(),
				acceptedEntities: null,
			};
			jest.spyOn(axios, 'post').mockResolvedValue({
				data: unexpectedResponse,
			});

			await expect(() =>
				jiraClient.submitDesigns(request, cloudId),
			).rejects.toThrowError(SchemaValidationError);
		});
	});

	describe('getIssue', () => {
		const issueKey = 'TEST-1';
		it('should return issue', async () => {
			const response = generateGetIssueResponse({ key: issueKey });
			jest.spyOn(axios, 'get').mockResolvedValue({ data: response });

			const result = await jiraClient.getIssue(issueKey, cloudId);

			expect(result).toBe(response);
			expect(axios.get).toHaveBeenCalledWith(
				`${expectedJiraApiBaseUrl(cloudId)}rest/api/3/issue/${issueKey}`,
				defaultExpectedRequestHeaders(),
			);
		});

		it('should throw when response has invalid schema', async () => {
			const unexpectedResponse = {
				...generateGetIssueResponse({ key: issueKey }),
				id: null,
			};
			jest.spyOn(axios, 'get').mockResolvedValue({ data: unexpectedResponse });

			await expect(() =>
				jiraClient.getIssue(issueKey, cloudId),
			).rejects.toThrowError(SchemaValidationError);
		});
	});

	describe('setAppProperty', () => {
		const propertyKey = 'property-key';
		it('should set app property', async () => {
			jest.spyOn(axios, 'put').mockResolvedValue({ status: HttpStatusCode.Ok });

			await jiraClient.setAppProperty(propertyKey, 'some value', cloudId);

			const headers = defaultExpectedRequestHeaders()
				.headers.setAccept('application/json')
				.setContentType('application/json');

			expect(axios.put).toHaveBeenCalledWith(
				`${expectedJiraApiBaseUrl(
					cloudId,
				)}rest/forge/1/app/properties/${propertyKey}`,
				JSON.stringify('some value'),
				{ headers },
			);
		});
	});

	describe('deleteAppProperty', () => {
		const propertyKey = 'property-key';
		it('should delete app property', async () => {
			jest
				.spyOn(axios, 'delete')
				.mockResolvedValue({ status: HttpStatusCode.NoContent });

			await jiraClient.deleteAppProperty(propertyKey, cloudId);

			expect(axios.delete).toHaveBeenCalledWith(
				`${expectedJiraApiBaseUrl(
					cloudId,
				)}rest/forge/1/app/properties/${propertyKey}`,
				defaultExpectedRequestHeaders(),
			);
		});
	});

	describe('checkPermissions', () => {
		it('should check permissions', async () => {
			const request: CheckPermissionsRequest =
				generateCheckPermissionsRequest();
			const response: CheckPermissionsResponse =
				generateCheckPermissionsResponse();
			jest.spyOn(axios, 'post').mockResolvedValue({
				status: HttpStatusCode.Ok,
				data: response,
			});

			const result = await jiraClient.checkPermissions(request, cloudId);

			expect(result).toBe(response);
			expect(axios.post).toHaveBeenCalledWith(
				`${expectedJiraApiBaseUrl(cloudId)}rest/api/3/permissions/check`,
				request,
				defaultExpectedRequestHeaders(),
			);
		});
	});
});
