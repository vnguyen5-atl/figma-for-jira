import { associatedFigmaDesignRepository } from './associated-figma-design-repository';

import {
	generateAssociatedFigmaDesign,
	generateAssociatedFigmaDesignCreateParams,
	generateCloudId,
} from '../../domain/entities/testing';

describe('AssociatedFigmaDesignRepository', () => {
	describe('deleteByDesignIdAndAssociatedWithAriAndCloudId', () => {
		it('should delete target entity', async () => {
			const cloudId = generateCloudId();
			const [targetAssociatedFigmaDesign, otherAssociatedFigmaDesign] =
				await Promise.all([
					associatedFigmaDesignRepository.upsert(
						generateAssociatedFigmaDesignCreateParams({ cloudId }),
					),
					associatedFigmaDesignRepository.upsert(
						generateAssociatedFigmaDesignCreateParams({ cloudId }),
					),
				]);

			const result =
				await associatedFigmaDesignRepository.deleteByDesignIdAndAssociatedWithAriAndCloudId(
					targetAssociatedFigmaDesign.designId,
					targetAssociatedFigmaDesign.associatedWithAri,
					targetAssociatedFigmaDesign.cloudId,
				);

			expect(result).toEqual(targetAssociatedFigmaDesign);
			expect(await associatedFigmaDesignRepository.getAll()).toEqual([
				otherAssociatedFigmaDesign,
			]);
		});

		it('should return null if target entity does not exist', async () => {
			const nonExistingAssociatedFigmaDesign = generateAssociatedFigmaDesign();
			const cloudId = generateCloudId();
			const associatedFigmaDesign =
				await associatedFigmaDesignRepository.upsert(
					generateAssociatedFigmaDesignCreateParams({ cloudId }),
				);

			const result =
				await associatedFigmaDesignRepository.deleteByDesignIdAndAssociatedWithAriAndCloudId(
					nonExistingAssociatedFigmaDesign.designId,
					nonExistingAssociatedFigmaDesign.associatedWithAri,
					nonExistingAssociatedFigmaDesign.cloudId,
				);

			expect(result).toBeNull();
			expect(await associatedFigmaDesignRepository.getAll()).toEqual([
				associatedFigmaDesign,
			]);
		});
	});
});
