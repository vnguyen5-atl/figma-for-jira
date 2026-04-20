import { createRemoteJWKSet, jwtVerify } from 'jose';

const FORGE_JWKS_URL =
	'https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json';

export type ForgeInvocationTokenClaims = {
	readonly iss: string;
	readonly aud: string;
	readonly cloudId: string;
	readonly accountId?: string;
	readonly isAdminUser?: boolean;
	readonly exp: number;
	readonly iat: number;
};

/**
 * Verifier for Forge Invocation Tokens (FIT).
 *
 * Requests from Forge to the remote backend include a FIT as a Bearer token
 * in the Authorization header. The FIT is a signed JWT that can be verified
 * using Atlassian's public JWKS endpoint.
 *
 * @see https://developer.atlassian.com/platform/forge/remote/essentials/#the-forge-invocation-token-fit-
 */
export class ForgeInvocationTokenVerifier {
	private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

	constructor(jwksUrl: string = FORGE_JWKS_URL) {
		this.jwks = createRemoteJWKSet(new URL(jwksUrl));
	}

	/**
	 * Verifies a FIT and returns its claims.
	 *
	 * @throws {Error} If the token is missing, invalid, expired, or intended for a different app.
	 */
	verify = async (
		token: string,
		appId: string,
	): Promise<ForgeInvocationTokenClaims> => {
		const { payload } = await jwtVerify(token, this.jwks, {
			audience: appId,
		});

		const { iss, aud, exp, iat } = payload;

		if (
			typeof iss !== 'string' ||
			typeof exp !== 'number' ||
			typeof iat !== 'number'
		) {
			throw new Error('Invalid FIT: missing required claims.');
		}

		const audValue = Array.isArray(aud) ? aud[0] : aud;
		if (typeof audValue !== 'string') {
			throw new Error('Invalid FIT: missing aud claim.');
		}

		const cloudId = payload['cloudId'];
		if (typeof cloudId !== 'string') {
			throw new Error('Invalid FIT: missing cloudId claim.');
		}

		const accountId = payload['accountId'];
		const isAdminUser = payload['isAdminUser'];

		return {
			iss,
			aud: audValue,
			cloudId,
			accountId: typeof accountId === 'string' ? accountId : undefined,
			isAdminUser: typeof isAdminUser === 'boolean' ? isAdminUser : undefined,
			exp,
			iat,
		};
	};
}

export const forgeInvocationTokenVerifier = new ForgeInvocationTokenVerifier();
