import {
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
	type KeyLike,
	SignJWT,
} from 'jose';

import { ForgeInvocationTokenVerifier } from './forge-invocation-token-verifier';

const TEST_APP_ID = 'ari:cloud:ecosystem::app/test-app-id';
const TEST_CLOUD_ID = 'test-cloud-id';
const TEST_ACCOUNT_ID = 'test-account-id';

/**
 * Creates a local JWKS for testing — avoids any real network calls.
 */
const createTestKeyPairAndJwks = async () => {
	const { publicKey, privateKey } = await generateKeyPair('RS256', {
		extractable: true,
	});
	const jwk = await exportJWK(publicKey);
	const jwks = { keys: [{ ...jwk, alg: 'RS256', kid: 'test-key' }] };
	return { privateKey, jwks };
};

const signToken = async (
	privateKey: KeyLike,
	payload: Record<string, unknown>,
	options: {
		audience?: string;
		expiresInSeconds?: number;
	} = {},
) => {
	const { audience = TEST_APP_ID, expiresInSeconds = 99999 } = options;
	const now = Math.floor(Date.now() / 1000);

	return new SignJWT(payload)
		.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
		.setIssuer('forge/invocation-token')
		.setAudience(audience)
		.setIssuedAt(now)
		.setExpirationTime(now + expiresInSeconds)
		.sign(privateKey);
};

describe('ForgeInvocationTokenVerifier', () => {
	let verifier: ForgeInvocationTokenVerifier;
	let privateKey: KeyLike;

	beforeEach(async () => {
		const { privateKey: pk, jwks } = await createTestKeyPairAndJwks();
		privateKey = pk;

		// Use a local JWKS set instead of fetching from the real Atlassian endpoint
		const localJwks = createLocalJWKSet(jwks);
		verifier = new ForgeInvocationTokenVerifier('https://unused-in-test');
		// @ts-expect-error — override private jwks for testing
		verifier.jwks = localJwks;
	});

	const TEST_API_BASE_URL = `https://api.atlassian.com/ex/jira/${TEST_CLOUD_ID}`;
	const APP_CLAIM = { apiBaseUrl: TEST_API_BASE_URL };

	describe('valid tokens', () => {
		it('should return claims for a valid token with accountId and isAdminUser', async () => {
			const token = await signToken(privateKey, {
				cloudId: TEST_CLOUD_ID,
				accountId: TEST_ACCOUNT_ID,
				isAdminUser: true,
				app: APP_CLAIM,
			});

			const claims = await verifier.verify(token, TEST_APP_ID);

			expect(claims.cloudId).toBe(TEST_CLOUD_ID);
			expect(claims.accountId).toBe(TEST_ACCOUNT_ID);
			expect(claims.isAdminUser).toBe(true);
			expect(claims.aud).toBe(TEST_APP_ID);
			expect(claims.iss).toBe('forge/invocation-token');
			expect(claims.apiBaseUrl).toBe(TEST_API_BASE_URL);
		});

		it('should return claims for a server-to-server token (no accountId or isAdminUser)', async () => {
			const token = await signToken(privateKey, {
				cloudId: TEST_CLOUD_ID,
				app: APP_CLAIM,
			});

			const claims = await verifier.verify(token, TEST_APP_ID);

			expect(claims.cloudId).toBe(TEST_CLOUD_ID);
			expect(claims.accountId).toBeUndefined();
			expect(claims.isAdminUser).toBeUndefined();
		});
	});

	describe('invalid tokens', () => {
		it('should throw for an expired token', async () => {
			const token = await signToken(
				privateKey,
				{ cloudId: TEST_CLOUD_ID, app: APP_CLAIM },
				{ expiresInSeconds: -1 },
			);

			await expect(verifier.verify(token, TEST_APP_ID)).rejects.toThrow();
		});

		it('should throw for a token with wrong audience', async () => {
			const token = await signToken(
				privateKey,
				{ cloudId: TEST_CLOUD_ID, app: APP_CLAIM },
				{ audience: 'ari:cloud:ecosystem::app/wrong-app' },
			);

			await expect(verifier.verify(token, TEST_APP_ID)).rejects.toThrow();
		});

		it('should throw for a token missing cloudId', async () => {
			const token = await signToken(privateKey, { app: APP_CLAIM });

			await expect(verifier.verify(token, TEST_APP_ID)).rejects.toThrow(
				'Invalid FIT: missing cloudId claim.',
			);
		});

		it('should throw for a token missing app.apiBaseUrl', async () => {
			const token = await signToken(privateKey, { cloudId: TEST_CLOUD_ID });

			await expect(verifier.verify(token, TEST_APP_ID)).rejects.toThrow(
				'Invalid FIT: missing app claim.',
			);
		});

		it('should throw for a completely invalid token string', async () => {
			await expect(verifier.verify('not.a.jwt', TEST_APP_ID)).rejects.toThrow();
		});
	});
});
