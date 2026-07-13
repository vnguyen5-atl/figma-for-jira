/**
 * Context required to make outbound Jira API calls from the remote backend.
 *
 * @remarks
 * In Forge Remote, every inbound request from Forge carries:
 * - A Forge Invocation Token (FIT) in the `Authorization` header, whose
 *   `app.apiBaseUrl` claim provides the Jira API base URL to call.
 * - An `x-forge-oauth-system` header (if `auth.appSystemToken.enabled` is
 *   set on the remote in the manifest) — the system bearer token used to
 *   authenticate the outbound call as the app.
 *
 * Both values are bundled into this `JiraCallContext` by the FIT middleware
 * and threaded through the use cases / services to the `jiraClient`.
 *
 * For Figma-webhook-driven flows (where there is no inbound FIT), the
 * `JiraCallContext` is hydrated from the persisted `jira_app_token` table
 * (kept fresh by a Forge `scheduledTrigger` function).
 *
 * @see https://developer.atlassian.com/platform/forge/remote/calling-product-apis
 */
export type JiraCallContext = {
	readonly cloudId: string;
	readonly apiBaseUrl: string;
	readonly appSystemToken: string;
};
