import axios, { AxiosHeaders } from 'axios';

import {
	CHECK_PERMISSIONS_RESPONSE_SCHEMA,
	GET_ISSUE_RESPONSE_SCHEMA,
	SUBMIT_DESIGNS_RESPONSE_SCHEMA,
} from './schemas';
import type {
	CheckPermissionsRequest,
	CheckPermissionsResponse,
	GetIssueResponse,
	SubmitDesignsRequest,
	SubmitDesignsResponse,
} from './types';

import { assertSchema } from '../../../common/schema-validation';
import type { JiraCallContext } from '../../../domain/entities';
import { withAxiosErrorTranslation } from '../../axios-utils';

/**
 * A Jira API client.
 *
 * @remarks
 * In Phase 5 of the Connect → Forge migration, every method takes a
 * {@link JiraCallContext} carrying the Forge-provided `apiBaseUrl` and
 * `appSystemToken`. The base URL must be exactly the value Forge sends
 * in the FIT (`app.apiBaseUrl` claim) — NOT a cloudId-derived URL.
 *
 * @see https://developer.atlassian.com/platform/forge/remote/calling-product-apis
 */
class JiraClient {
	/**
	 * Insert/update design data.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	submitDesigns = async (
		payload: SubmitDesignsRequest,
		ctx: JiraCallContext,
	): Promise<SubmitDesignsResponse> => {
		const context = { cloudId: ctx.cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = this.buildUrl(ctx, 'rest/designs/1.0/bulk');

			const response = await axios.post<unknown>(url, payload, {
				headers: this.buildHeaders(ctx),
			});

			assertSchema(response.data, SUBMIT_DESIGNS_RESPONSE_SCHEMA);

			return response.data;
		}, context);
	};

	/**
	 * Returns a single issue, for a given issue ID or issue key.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	getIssue = async (
		issueIdOrKey: string,
		ctx: JiraCallContext,
	): Promise<GetIssueResponse> => {
		const context = { issueIdOrKey, cloudId: ctx.cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = this.buildUrl(
				ctx,
				`rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`,
			);

			const response = await axios.get<unknown>(url, {
				headers: this.buildHeaders(ctx),
			});

			assertSchema(response.data, GET_ISSUE_RESPONSE_SCHEMA);

			return response.data;
		}, context);
	};

	/**
	 * Sets a Forge app property.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	setAppProperty = async (
		propertyKey: string,
		value: unknown,
		ctx: JiraCallContext,
	): Promise<void> => {
		const context = { propertyKey, cloudId: ctx.cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = this.buildUrl(
				ctx,
				`rest/forge/1/app/properties/${encodeURIComponent(propertyKey)}`,
			);

			await axios.put<unknown>(url, JSON.stringify(value), {
				headers: this.buildHeaders(ctx)
					.setAccept('application/json')
					.setContentType('application/json'),
			});
		}, context);
	};

	/**
	 * Deletes a Forge app property.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	deleteAppProperty = async (
		propertyKey: string,
		ctx: JiraCallContext,
	): Promise<void> => {
		const context = { propertyKey, cloudId: ctx.cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = this.buildUrl(
				ctx,
				`rest/forge/1/app/properties/${encodeURIComponent(propertyKey)}`,
			);

			await axios.delete(url, {
				headers: this.buildHeaders(ctx),
			});
		}, context);
	};

	/**
	 * Returns a list of requested global and project permissions.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	checkPermissions = async (
		payload: CheckPermissionsRequest,
		ctx: JiraCallContext,
	): Promise<CheckPermissionsResponse> => {
		const context = { cloudId: ctx.cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = this.buildUrl(ctx, `rest/api/3/permissions/check`);

			const response = await axios.post<unknown>(url, payload, {
				headers: this.buildHeaders(ctx),
			});

			assertSchema(response.data, CHECK_PERMISSIONS_RESPONSE_SCHEMA);

			return response.data;
		}, context);
	};

	private buildUrl(ctx: JiraCallContext, path: string): string {
		const base = ctx.apiBaseUrl.endsWith('/')
			? ctx.apiBaseUrl
			: `${ctx.apiBaseUrl}/`;
		return new URL(path, base).toString();
	}

	private buildHeaders(ctx: JiraCallContext): AxiosHeaders {
		return new AxiosHeaders().setAuthorization(`Bearer ${ctx.appSystemToken}`);
	}
}

export const jiraClient = new JiraClient();
