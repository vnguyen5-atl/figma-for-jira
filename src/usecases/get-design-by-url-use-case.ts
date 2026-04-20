import {
	FigmaDesignNotFoundUseCaseResultError,
	ForbiddenByFigmaUseCaseResultError,
	InvalidInputUseCaseResultError,
} from './errors';

import type { AtlassianDesign } from '../domain/entities';
import { FigmaDesignIdentifier } from '../domain/entities';
import {
	figmaService,
	UnauthorizedFigmaServiceError,
} from '../infrastructure/figma';

export type GetDesignByUrlUseCaseParams = {
	readonly designUrl: URL;
	readonly atlassianUserId: string;
	readonly cloudId: string;
};

export const getDesignByUrlUseCase = {
	/**
	 * Returns {@link AtlassianDesign} for the given Figma URL.
	 *
	 * @throws {ForbiddenByFigmaUseCaseResultError} Not authorized to access Figma.
	 * @throws {InvalidInputUseCaseResultError} The given design URL is invalid.
	 */
	execute: async ({
		designUrl,
		atlassianUserId,
		cloudId,
	}: GetDesignByUrlUseCaseParams): Promise<AtlassianDesign> => {
		let figmaDesignId: FigmaDesignIdentifier;
		try {
			figmaDesignId = FigmaDesignIdentifier.fromFigmaDesignUrl(designUrl);
		} catch (e) {
			throw new InvalidInputUseCaseResultError(
				'The given design URL is invalid',
			);
		}

		try {
			const design = await figmaService.getDesignOrParent(figmaDesignId, {
				atlassianUserId,
				cloudId,
			});

			if (!design) throw new FigmaDesignNotFoundUseCaseResultError();

			return design;
		} catch (e) {
			if (e instanceof UnauthorizedFigmaServiceError) {
				throw new ForbiddenByFigmaUseCaseResultError(e);
			}

			throw e;
		}
	},
};
