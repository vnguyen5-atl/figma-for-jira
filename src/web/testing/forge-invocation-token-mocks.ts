import { generateKeyPair, type KeyLike, SignJWT } from 'jose';

/**
 * Generates a Forge Invocation Token (FIT) signed with a test RSA key pair.
 *
 * Use in tests alongside a mock of `forgeInvocationTokenVerifier.verify`, or
 * by mocking the JWKS endpoint to return the matching public key.
 */
export const generateForgeInvocationToken = async ({
	appId,
	cloudId,
	accountId,
	apiBaseUrl,
	installationId,
	expiresInSeconds = 99999,
}: {
	appId: string;
	cloudId: string;
	accountId?: string;
	apiBaseUrl?: string;
	installationId?: string;
	expiresInSeconds?: number;
}): Promise<{ token: string; publicKey: KeyLike; privateKey: KeyLike }> => {
	const { publicKey, privateKey } = await generateKeyPair('RS256');

	const now = Math.floor(Date.now() / 1000);

	// Mirrors the real FIT shape observed at runtime — see
	// src/web/middleware/forge/forge-invocation-token-verifier.ts
	// for the corresponding extraction logic.
	const token = await new SignJWT({
		context: {
			cloudId,
			...(accountId !== undefined ? { accountId } : {}),
		},
		app: {
			apiBaseUrl: apiBaseUrl ?? `https://api.atlassian.com/ex/jira/${cloudId}`,
			...(installationId !== undefined ? { installationId } : {}),
		},
	})
		.setProtectedHeader({ alg: 'RS256' })
		.setIssuer('forge/invocation-token')
		.setAudience(appId)
		.setIssuedAt(now)
		.setExpirationTime(now + expiresInSeconds)
		.sign(privateKey);

	return { token, publicKey, privateKey };
};
