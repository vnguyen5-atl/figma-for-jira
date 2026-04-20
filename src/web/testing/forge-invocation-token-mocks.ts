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
	isAdminUser,
	expiresInSeconds = 99999,
}: {
	appId: string;
	cloudId: string;
	accountId?: string;
	isAdminUser?: boolean;
	expiresInSeconds?: number;
}): Promise<{ token: string; publicKey: KeyLike; privateKey: KeyLike }> => {
	const { publicKey, privateKey } = await generateKeyPair('RS256');

	const now = Math.floor(Date.now() / 1000);

	const token = await new SignJWT({
		cloudId,
		...(accountId !== undefined ? { accountId } : {}),
		...(isAdminUser !== undefined ? { isAdminUser } : {}),
	})
		.setProtectedHeader({ alg: 'RS256' })
		.setIssuer('forge')
		.setAudience(appId)
		.setIssuedAt(now)
		.setExpirationTime(now + expiresInSeconds)
		.sign(privateKey);

	return { token, publicKey, privateKey };
};
