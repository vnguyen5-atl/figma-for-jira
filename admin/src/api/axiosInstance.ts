import { requestRemote } from '@forge/bridge';

/**
 * Wrapper around the Forge bridge `requestRemote` for calling our remote
 * Express backend.
 *
 * Forge automatically injects a Forge Invocation Token (FIT) as the
 * `Authorization: Bearer …` header on the request. The backend's
 * `forgeInvocationTokenMiddleware` verifies the FIT and extracts
 * `cloudId` / `accountId` / `isAdminUser` / `apiBaseUrl` for use by
 * downstream handlers. We therefore do not need to attach any auth
 * tokens manually.
 *
 * The first argument (`'connect'`) refers to the `key` of the remote
 * defined under `remotes:` in the Forge `manifest.yml`.
 */

const REMOTE_KEY = 'connect';

/**
 * Thrown when a remote request returns a non-2xx response. Mirrors the bits
 * of `AxiosError` the admin UI used to depend on (status code + parsed body).
 */
export class RemoteResponseError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(status: number, statusText: string, body: unknown) {
		super(`Remote request failed: ${status} ${statusText}`);
		this.name = 'RemoteResponseError';
		this.status = status;
		this.body = body;
	}
}

const ensureOk = async (response: Response): Promise<Response> => {
	if (!response.ok) {
		let body: unknown = undefined;
		try {
			body = await response.clone().json();
		} catch {
			try {
				body = await response.clone().text();
			} catch {
				/* swallow */
			}
		}
		throw new RemoteResponseError(response.status, response.statusText, body);
	}
	return response;
};

export const remoteFetch = async (
	path: string,
	init: RequestInit = {},
): Promise<Response> => {
	const response = await requestRemote(REMOTE_KEY, { path, ...init });
	return await ensureOk(response);
};

export const remoteGetJson = async <T>(path: string): Promise<T> => {
	const response = await remoteFetch(path, { method: 'GET' });
	return (await response.json()) as T;
};

export const remotePostJson = async <T>(
	path: string,
	body?: unknown,
): Promise<T | undefined> => {
	const response = await remoteFetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	if (response.status === 204) return undefined;
	const text = await response.text();
	return text ? (JSON.parse(text) as T) : undefined;
};

export const remoteDelete = async (path: string): Promise<void> => {
	await remoteFetch(path, { method: 'DELETE' });
};
