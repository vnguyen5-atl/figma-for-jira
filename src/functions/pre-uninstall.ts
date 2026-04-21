import { fetch } from '@forge/api';

/**
 * Forge `preUninstall` lifecycle handler.
 *
 * @remarks
 * This Forge function is invoked by the Forge platform when the app is being
 * uninstalled. It forwards the event to the remote backend's
 * `/lifecycleEvents/uninstalled` endpoint, which performs cleanup
 * (deleting Figma webhooks, app data, etc.).
 *
 * The Forge platform allows up to 55 seconds for this handler to complete.
 *
 * @see https://developer.atlassian.com/platform/forge/manifest-reference/modules/pre-uninstall/
 */

const REMOTE_URL = process.env.REMOTE_URL;

type PreUninstallEvent = {
	readonly cloudId?: string;
	readonly context?: {
		readonly cloudId?: string;
	};
};

export const handler = async (event: PreUninstallEvent): Promise<void> => {
	if (!REMOTE_URL) {
		throw new Error(
			'REMOTE_URL environment variable is not set on the Forge function.',
		);
	}

	const cloudId = event.cloudId ?? event.context?.cloudId;
	if (!cloudId) {
		throw new Error('preUninstall event missing cloudId.');
	}

	// `@forge/api`'s `fetch` automatically includes a Forge Invocation Token
	// (FIT) in the Authorization header, which the remote backend's
	// `forgeInvocationTokenMiddleware` will verify.
	const response = await fetch(`${REMOTE_URL}/lifecycleEvents/uninstalled`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cloudId }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Remote uninstall failed: ${response.status} ${response.statusText} — ${text}`,
		);
	}
};
