import type { Request } from 'supertest';

import { generateForgeInvocationToken } from './forge-invocation-token-mocks';

import { getConfig } from '../../config';
import { forgeInvocationTokenVerifier } from '../middleware/forge';

/**
 * Mocks the FIT verifier so integration tests don't need a real JWKS endpoint.
 *
 * Returns the token + expected verified-claims object that callers can use to
 * decorate `supertest` requests via {@link withForgeAuth}.
 *
 * Use in `beforeEach`:
 * ```
 * const fit = await mockForgeInvocationToken({ cloudId, isAdminUser: true });
 * await request(app).get(...).set(fit.headers).expect(200);
 * ```
 */
export const mockForgeInvocationToken = async ({
	cloudId,
	accountId = 'test-account-id',
	isAdminUser = true,
	apiBaseUrl,
	appSystemToken = 'test-app-system-token',
}: {
	cloudId: string;
	accountId?: string;
	isAdminUser?: boolean;
	apiBaseUrl?: string;
	appSystemToken?: string;
}): Promise<{
	token: string;
	headers: Record<string, string>;
	apiBaseUrl: string;
}> => {
	const resolvedApiBaseUrl =
		apiBaseUrl ?? `https://api.atlassian.com/ex/jira/${cloudId}`;
	const { token } = await generateForgeInvocationToken({
		appId: getConfig().app.id,
		cloudId,
		accountId,
		isAdminUser,
		apiBaseUrl: resolvedApiBaseUrl,
	});

	// Bypass the real JWKS verification; integration tests should focus on
	// behaviour, not on the FIT signature mechanics (those are covered by
	// the unit tests for ForgeInvocationTokenVerifier).
	jest.spyOn(forgeInvocationTokenVerifier, 'verify').mockResolvedValue({
		iss: 'forge/invocation-token',
		aud: getConfig().app.id,
		cloudId,
		accountId,
		isAdminUser,
		apiBaseUrl: resolvedApiBaseUrl,
		exp: Math.floor(Date.now() / 1000) + 99999,
		iat: Math.floor(Date.now() / 1000),
	});

	return {
		token,
		apiBaseUrl: resolvedApiBaseUrl,
		headers: {
			Authorization: `Bearer ${token}`,
			'x-forge-oauth-system': appSystemToken,
		},
	};
};

/**
 * Convenience: applies FIT-auth headers to a supertest request chain.
 *
 * Allows: `await withForgeAuth(request(app).get('/foo'), fit).expect(200);`
 */
export const withForgeAuth = (
	req: Request,
	fit: { headers: Record<string, string> },
): Request => {
	for (const [key, value] of Object.entries(fit.headers)) {
		req.set(key, value);
	}
	return req;
};
