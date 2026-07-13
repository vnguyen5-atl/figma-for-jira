import type { FigmaOAuth2UserCredentials as PrismaFigmaOAuth2UserCredentials } from '@prisma/client';

import { NotFoundRepositoryError } from './errors';
import { prismaClient } from './prisma-client';

import type { FigmaOAuth2UserCredentialsCreateParams } from '../../domain/entities';
import { FigmaOAuth2UserCredentials } from '../../domain/entities';

type PrismaFigmaOAuth2UserCredentialsCreateParams = Omit<
	PrismaFigmaOAuth2UserCredentials,
	'id'
>;

export class FigmaOAuth2UserCredentialsRepository {
	upsert = async (
		createParams: FigmaOAuth2UserCredentialsCreateParams,
	): Promise<FigmaOAuth2UserCredentials> => {
		const createParamsDbModel = this.mapCreateParamsToDbModel(createParams);

		const dbModel = await prismaClient.get().figmaOAuth2UserCredentials.upsert({
			create: createParamsDbModel,
			update: createParamsDbModel,
			where: {
				atlassianUserId_cloudId: {
					atlassianUserId: createParamsDbModel.atlassianUserId,
					cloudId: createParamsDbModel.cloudId,
				},
			},
		});
		return this.mapToDomainModel(dbModel);
	};

	/**
	 * @throws {NotFoundRepositoryError} An entity is not found.
	 */
	get = async (
		atlassianUserId: string,
		cloudId: string,
	): Promise<FigmaOAuth2UserCredentials> => {
		const credentials = await prismaClient
			.get()
			.figmaOAuth2UserCredentials.findFirst({
				where: {
					atlassianUserId,
					cloudId,
				},
			});
		if (credentials === null) {
			throw new NotFoundRepositoryError(
				`FigmaOAuth2UserCredentials for user ${atlassianUserId} is not found.`,
			);
		}

		return this.mapToDomainModel(credentials);
	};

	/**
	 * @internal
	 * Required for tests only.
	 */
	getAll = async (): Promise<FigmaOAuth2UserCredentials[]> => {
		const dbModels = await prismaClient
			.get()
			.figmaOAuth2UserCredentials.findMany();

		return dbModels.map((dbModel) => this.mapToDomainModel(dbModel));
	};

	delete = async (
		atlassianUserId: string,
		cloudId: string,
	): Promise<FigmaOAuth2UserCredentials> => {
		const dbModel = await prismaClient.get().figmaOAuth2UserCredentials.delete({
			where: {
				atlassianUserId_cloudId: {
					atlassianUserId,
					cloudId,
				},
			},
		});
		return this.mapToDomainModel(dbModel);
	};

	private mapCreateParamsToDbModel = ({
		atlassianUserId,
		accessToken,
		refreshToken,
		expiresAt,
		cloudId,
	}: FigmaOAuth2UserCredentialsCreateParams): PrismaFigmaOAuth2UserCredentialsCreateParams => ({
		atlassianUserId,
		accessToken,
		refreshToken,
		expiresAt,
		cloudId,
	});

	private mapToDomainModel = (
		dbModel: PrismaFigmaOAuth2UserCredentials,
	): FigmaOAuth2UserCredentials => {
		return new FigmaOAuth2UserCredentials(
			dbModel.id.toString(),
			dbModel.atlassianUserId,
			dbModel.accessToken,
			dbModel.refreshToken,
			dbModel.expiresAt,
			dbModel.cloudId,
		);
	};
}

export const figmaOAuth2UserCredentialsRepository =
	new FigmaOAuth2UserCredentialsRepository();
