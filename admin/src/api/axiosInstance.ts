import { invokeRemote } from '@forge/bridge';

/**
 * Wrapper around the Forge bridge `invokeRemote` for calling our remote
 * Express backend.
 *
 * Why `invokeRemote` and not `requestRemote`?
 * The `requestRemote` API explicitly does NOT include OAuth tokens on
 * the outbound request. `invokeRemote` does — it routes through the
 * `endpoint` declared in `manifest.yml` (referenced via the UI module's
 * `resolver.endpoint` property), which is the only way Forge will
 * inject the `x-forge-oauth-system` header that our backend needs to
 * call Atlassian APIs on behalf of the app.
 *
 * `invokeRemote` returns a parsed JSON response shape rather than a
 * Fetch-style `Response`:
 *   { body: <parsed body>, headers: {...}, ...status info }
 *
 * Non-2xx responses do NOT throw automatically — only 401s reject the
 * promise. We add status checking ourselves to mirror the previous
 * Axios-style ergonomics callers depended on.
 */

interface InvokeRemoteResult {
	body?: unknown;
	headers?: Record<string, string>;
	statusCode?: number;
	status?: number;
}

/**
 * Thrown when a remote request returns a non-2xx response. Mirrors the
 * subset of `AxiosError` the admin UI relied on (status code + body).
 */
export class RemoteResponseError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(status: number, body: unknown) {
		super(`Remote request failed: ${status}`);
		this.name = 'RemoteResponseError';
		this.status = status;
		this.body = body;
	}
}

const getStatus = (result: InvokeRemoteResult): number =>
	result.statusCode ?? result.status ?? 200;

const ensureOk = (result: InvokeRemoteResult): InvokeRemoteResult => {
	const status = getStatus(result);
	if (status >= 400) {
		throw new RemoteResponseError(status, result.body);
	}
	return result;
};

export const remoteGetJson = async <T>(path: string): Promise<T> => {
	const result = (await invokeRemote({
		path,
		method: 'GET',
	})) as InvokeRemoteResult;
	ensureOk(result);
	return result.body as T;
};

export const remotePostJson = async <T>(
	path: string,
	body?: unknown,
): Promise<T | undefined> => {
	const result = (await invokeRemote({
		path,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
	})) as InvokeRemoteResult;
	ensureOk(result);
	return result.body as T | undefined;
};

export const remoteDelete = async (path: string): Promise<void> => {
	const result = (await invokeRemote({
		path,
		method: 'DELETE',
	})) as InvokeRemoteResult;
	ensureOk(result);
};
