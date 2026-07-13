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
import type { JiraCallContext } from '../../../domain/entities';
import { generateJiraCallContext } from '../../../domain/entities/testing';

describe('JiraClient', () => {
	let jiraCallContext: JiraCallContext;

	const expectedRequestHeaders = (ctx: JiraCallContext) => ({
		headers: new AxiosHeaders().setAuthorization(
			`Bearer ${ctx.appSystemToken}`,
		),
	});

	beforeEach(() => {
		jiraCallContext = generateJiraCallContext();
	});

	describe('submitDesigns', () => {
		it('should submit designs', async () => {
			const request = generateSubmitDesignsRequest();
			const response = generateSuccessfulSubmitDesignsResponse([
				request.designs[0].id,
			]);
			jest.spyOn(axios, 'post').mockResolvedValue({ data: response });

			const result = await jiraClient.submitDesigns(request, jiraCallContext);

			expect(result).toBe(response);
			expect(axios.post).toHaveBeenCalledWith(
				`${jiraCallContext.apiBaseUrl}/rest/designs/1.0/bulk`,
				request,
				expectedRequestHeaders(jiraCallContext),
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
				jiraClient.submitDesigns(request, jiraCallContext),
			).rejects.toThrowError(SchemaValidationError);
		});
	});

	describe('getIssue', () => {
		const issueKey = 'TEST-1';
		it('should return issue', async () => {
			const response = generateGetIssueResponse({ key: issueKey });
			jest.spyOn(axios, 'get').mockResolvedValue({ data: response });

			const result = await jiraClient.getIssue(issueKey, jiraCallContext);

			expect(result).toBe(response);
			expect(axios.get).toHaveBeenCalledWith(
				`${jiraCallContext.apiBaseUrl}/rest/api/3/issue/${issueKey}`,
				expectedRequestHeaders(jiraCallContext),
			);
		});

		it('should throw when response has invalid schema', async () => {
			const unexpectedResponse = {
				...generateGetIssueResponse({ key: issueKey }),
				id: null,
			};
			jest.spyOn(axios, 'get').mockResolvedValue({ data: unexpectedResponse });

			await expect(() =>
				jiraClient.getIssue(issueKey, jiraCallContext),
			).rejects.toThrowError(SchemaValidationError);
		});
	});

	describe('setAppProperty', () => {
		const propertyKey = 'property-key';
		it('should set app property', async () => {
			jest.spyOn(axios, 'put').mockResolvedValue({ status: HttpStatusCode.Ok });

			await jiraClient.setAppProperty(
				propertyKey,
				'some value',
				jiraCallContext,
			);

			const headers = expectedRequestHeaders(jiraCallContext)
				.headers.setAccept('application/json')
				.setContentType('application/json');

			expect(axios.put).toHaveBeenCalledWith(
				`${jiraCallContext.apiBaseUrl}/rest/forge/1/app/properties/${propertyKey}`,
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

			await jiraClient.deleteAppProperty(propertyKey, jiraCallContext);

			expect(axios.delete).toHaveBeenCalledWith(
				`${jiraCallContext.apiBaseUrl}/rest/forge/1/app/properties/${propertyKey}`,
				expectedRequestHeaders(jiraCallContext),
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

			const result = await jiraClient.checkPermissions(
				request,
				jiraCallContext,
			);

			expect(result).toBe(response);
			expect(axios.post).toHaveBeenCalledWith(
				`${jiraCallContext.apiBaseUrl}/rest/api/3/permissions/check`,
				request,
				expectedRequestHeaders(jiraCallContext),
			);
		});
	});
});
