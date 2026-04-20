import type { AssociatedFigmaDesign as PrismaAssociatedFigmaDesign } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PrismaErrorCode } from './constants';
import { prismaClient } from './prisma-client';

import type {
	AssociatedFigmaDesign,
	AssociatedFigmaDesignCreateParams,
} from '../../domain/entities';
import { FigmaDesignIdentifier } from '../../domain/entities';

type PrismaAssociatedFigmaDesignCreateParams = Omit<
	PrismaAssociatedFigmaDesign,
	'id'
>;

export class AssociatedFigmaDesignRepository {
	upsert = async (
		createParams: AssociatedFigmaDesignCreateParams,
	): Promise<AssociatedFigmaDesign> => {
		const createParamsDbModel = this.mapCreateParamsToDbModel(createParams);

		const dbModel = await prismaClient.get().associatedFigmaDesign.upsert({
			create: createParamsDbModel,
			update: createParamsDbModel,
			where: {
				fileKey_nodeId_associatedWithAri_cloudId: {
					fileKey: createParamsDbModel.fileKey,
					nodeId: createParamsDbModel.nodeId,
					associatedWithAri: createParamsDbModel.associatedWithAri,
					cloudId: createParamsDbModel.cloudId,
				},
			},
		});
		return this.mapToDomainModel(dbModel);
	};

	/**
	 * @internal
	 * Required for tests only.
	 */
	getAll = async (): Promise<AssociatedFigmaDesign[]> => {
		const dbModels = await prismaClient.get().associatedFigmaDesign.findMany();

		return dbModels.map((dbModel) => this.mapToDomainModel(dbModel));
	};

	findManyByFileKeyAndCloudId = async (
		fileKey: string,
		cloudId: string,
	): Promise<AssociatedFigmaDesign[]> => {
		const dbModels = await prismaClient.get().associatedFigmaDesign.findMany({
			where: { fileKey, cloudId },
		});

		return dbModels.map(this.mapToDomainModel);
	};

	deleteByDesignIdAndAssociatedWithAriAndCloudId = async (
		designId: FigmaDesignIdentifier,
		associatedWithAri: string,
		cloudId: string,
	): Promise<AssociatedFigmaDesign | null> => {
		try {
			const record = await prismaClient.get().associatedFigmaDesign.delete({
				where: {
					fileKey_nodeId_associatedWithAri_cloudId: {
						fileKey: designId.fileKey,
						nodeId: designId.nodeId ?? '',
						associatedWithAri: associatedWithAri,
						cloudId,
					},
				},
			});

			return this.mapToDomainModel(record);
		} catch (e: unknown) {
			if (
				e instanceof PrismaClientKnownRequestError &&
				e.code === PrismaErrorCode.RecordNotFound
			) {
				return null;
			}
			throw e;
		}
	};

	private mapToDomainModel = ({
		id,
		fileKey,
		nodeId,
		associatedWithAri,
		cloudId,
		inputUrl,
	}: PrismaAssociatedFigmaDesign): AssociatedFigmaDesign => ({
		id: id.toString(),
		designId: new FigmaDesignIdentifier(
			fileKey,
			nodeId !== '' ? nodeId : undefined,
		),
		associatedWithAri,
		cloudId,
		inputUrl: inputUrl ?? undefined,
	});

	private mapCreateParamsToDbModel = ({
		designId,
		associatedWithAri,
		cloudId,
		inputUrl,
	}: AssociatedFigmaDesignCreateParams): PrismaAssociatedFigmaDesignCreateParams => ({
		fileKey: designId.fileKey,
		nodeId: designId.nodeId ?? '',
		associatedWithAri,
		cloudId,
		inputUrl: inputUrl ?? null,
	});
}

export const associatedFigmaDesignRepository =
	new AssociatedFigmaDesignRepository();
