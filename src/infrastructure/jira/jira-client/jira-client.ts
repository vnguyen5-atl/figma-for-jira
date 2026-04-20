import type { Method } from 'axios';
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
import { withAxiosErrorTranslation } from '../../axios-utils';

/**
 * The base URL for Jira API calls in Forge. Forge proxies all calls to this
 * base URL using its own OAuth 2.0 app token (Phase 5).
 *
 * @see https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
 */
const JIRA_API_BASE_URL = 'https://api.atlassian.com';

/**
 * Builds the Jira REST API base URL for the given Forge cloud ID.
 */
const buildBaseUrl = (cloudId: string): string =>
	`${JIRA_API_BASE_URL}/ex/jira/${cloudId}/`;

/**
 * A Jira API client.
 *
 * @remarks
 * In Phase 4 of the Connect → Forge migration, the inbound `cloudId` parameter
 * replaces `ConnectInstallation`. The outbound auth header is currently a
 * placeholder Bearer token — Phase 5 replaces it with a real Forge OAuth 2.0
 * app access token obtained from the Forge platform.
 *
 * @see https://developer.atlassian.com/cloud/jira/software/rest/intro/#introduction
 */
class JiraClient {
	/**
	 * Insert/update design data.
	 *
	 * @throws {HttpClientError} An error associated with specific HTTP response status codes.
	 */
	submitDesigns = async (
		payload: SubmitDesignsRequest,
		cloudId: string,
	): Promise<SubmitDesignsResponse> => {
		const context = { cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = new URL('rest/designs/1.0/bulk', buildBaseUrl(cloudId));

			const response = await axios.post<unknown>(url.toString(), payload, {
				headers: new AxiosHeaders().setAuthorization(
					this.buildAuthorizationHeader('POST', url, cloudId),
				),
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
		cloudId: string,
	): Promise<GetIssueResponse> => {
		const context = { issueIdOrKey, cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = new URL(
				`rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`,
				buildBaseUrl(cloudId),
			);

			const response = await axios.get<unknown>(url.toString(), {
				headers: new AxiosHeaders().setAuthorization(
					this.buildAuthorizationHeader('GET', url, cloudId),
				),
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
		cloudId: string,
	): Promise<void> => {
		const context = { propertyKey, cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = new URL(
				`rest/forge/1/app/properties/${encodeURIComponent(propertyKey)}`,
				buildBaseUrl(cloudId),
			);

			await axios.put<unknown>(url.toString(), JSON.stringify(value), {
				headers: new AxiosHeaders()
					.setAuthorization(this.buildAuthorizationHeader('PUT', url, cloudId))
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
		cloudId: string,
	): Promise<void> => {
		const context = { propertyKey, cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = new URL(
				`rest/forge/1/app/properties/${encodeURIComponent(propertyKey)}`,
				buildBaseUrl(cloudId),
			);

			await axios.delete(url.toString(), {
				headers: new AxiosHeaders().setAuthorization(
					this.buildAuthorizationHeader('DELETE', url, cloudId),
				),
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
		cloudId: string,
	): Promise<CheckPermissionsResponse> => {
		const context = { cloudId };
		return withAxiosErrorTranslation(async () => {
			const url = new URL(
				`rest/api/3/permissions/check`,
				buildBaseUrl(cloudId),
			);

			const response = await axios.post<unknown>(url.toString(), payload, {
				headers: new AxiosHeaders().setAuthorization(
					this.buildAuthorizationHeader('POST', url, cloudId),
				),
			});

			assertSchema(response.data, CHECK_PERMISSIONS_RESPONSE_SCHEMA);

			return response.data;
		}, context);
	};

	/**
	 * Builds the Authorization header for outbound Jira API calls.
	 *
	 * Currently returns a placeholder. Phase 5 of the migration replaces this
	 * with a real Forge OAuth 2.0 app access token obtained from the Forge
	 * platform (`@forge/api` or the equivalent Forge Remote auth flow).
	 */
	private buildAuthorizationHeader(
		_method: Method,
		_url: URL,
		_cloudId: string,
	) {
		// TODO (Phase 5): obtain a Forge app access token for `cloudId` and
		// return `Bearer ${token}`. See MIGRATION_PLAN.md.
		return 'Bearer FORGE_APP_TOKEN_PLACEHOLDER';
	}
}

export const jiraClient = new JiraClient();
