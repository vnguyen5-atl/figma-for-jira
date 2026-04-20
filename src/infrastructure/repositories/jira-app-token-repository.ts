import { NotFoundRepositoryError } from './errors';
import { prismaClient } from './prisma-client';

import type { JiraCallContext } from '../../domain/entities';

/**
 * Persists Forge app system tokens per cloudId so background flows
 * (e.g. Figma webhooks) can call Jira APIs without an inbound FIT.
 *
 * The token's expiry comes from the JWT's `exp` claim (decoded by the
 * caller) — see {@link upsert} for the contract.
 */
export class JiraAppTokenRepository {
	/**
	 * Insert or update the persisted token for a cloudId.
	 *
	 * @param expiresAt — derived from the system-token JWT's `exp` claim
	 *                   so we can detect staleness without re-decoding.
	 */
	upsert = async (params: {
		readonly cloudId: string;
		readonly apiBaseUrl: string;
		readonly appSystemToken: string;
		readonly expiresAt: Date;
	}): Promise<void> => {
		await prismaClient.get().jiraAppToken.upsert({
			where: { cloudId: params.cloudId },
			create: {
				cloudId: params.cloudId,
				apiBaseUrl: params.apiBaseUrl,
				appSystemToken: params.appSystemToken,
				expiresAt: params.expiresAt,
			},
			update: {
				apiBaseUrl: params.apiBaseUrl,
				appSystemToken: params.appSystemToken,
				expiresAt: params.expiresAt,
			},
		});
	};

	/**
	 * Returns a {@link JiraCallContext} hydrated from the persisted token.
	 *
	 * @throws {RepositoryRecordNotFoundError} If no token has been
	 *         persisted yet for this cloudId.
	 *
	 * @remarks
	 * This does NOT validate that the token is unexpired — callers should
	 * either trust the scheduled-trigger refresh or check `expiresAt`
	 * themselves.
	 */
	getJiraCallContext = async (cloudId: string): Promise<JiraCallContext> => {
		const row = await prismaClient.get().jiraAppToken.findUnique({
			where: { cloudId },
		});

		if (!row) {
			throw new NotFoundRepositoryError(
				`No persisted Jira app token for cloudId ${cloudId}.`,
			);
		}

		return {
			cloudId: row.cloudId,
			apiBaseUrl: row.apiBaseUrl,
			appSystemToken: row.appSystemToken,
		};
	};

	deleteByCloudId = async (cloudId: string): Promise<void> => {
		await prismaClient.get().jiraAppToken.deleteMany({ where: { cloudId } });
	};
}

export const jiraAppTokenRepository = new JiraAppTokenRepository();
