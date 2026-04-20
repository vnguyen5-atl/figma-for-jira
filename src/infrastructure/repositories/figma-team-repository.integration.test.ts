import { v4 as uuidv4 } from 'uuid';

import { figmaTeamRepository } from './figma-team-repository';

import type { FigmaTeam } from '../../domain/entities';
import {
	generateCloudId,
	generateFigmaTeamCreateParams,
} from '../../domain/entities/testing';

const figmaTeamComparer = (first: FigmaTeam, second: FigmaTeam) =>
	first.id.localeCompare(second.id);

describe('FigmaTeamRepository', () => {
	describe('findByWebhookId', () => {
		it('should return team with given webhook ID', async () => {
			const cloudId = generateCloudId();
			const webhookId = uuidv4();
			const figmaTeam = await figmaTeamRepository.upsert(
				generateFigmaTeamCreateParams({ cloudId, webhookId }),
			);

			const result = await figmaTeamRepository.findByWebhookId(webhookId);

			expect(result).toEqual(figmaTeam);
		});

		it('should return null when there is no team with given webhook ID', async () => {
			const cloudId = generateCloudId();
			await figmaTeamRepository.upsert(
				generateFigmaTeamCreateParams({ cloudId }),
			);
			const webhookId = uuidv4();

			const result = await figmaTeamRepository.findByWebhookId(webhookId);

			expect(result).toBeNull();
		});
	});

	describe('findManyByCloudId', () => {
		it('should return teams with given cloud ID', async () => {
			const targetCloudId = generateCloudId();
			const otherCloudId = generateCloudId();
			const [targetFigmaTeam1, targetFigmaTeam2] = await Promise.all([
				figmaTeamRepository.upsert(
					generateFigmaTeamCreateParams({ cloudId: targetCloudId }),
				),
				figmaTeamRepository.upsert(
					generateFigmaTeamCreateParams({ cloudId: targetCloudId }),
				),
				figmaTeamRepository.upsert(
					generateFigmaTeamCreateParams({ cloudId: otherCloudId }),
				),
			]);

			const result = await figmaTeamRepository.findManyByCloudId(targetCloudId);

			expect(result.sort(figmaTeamComparer)).toEqual(
				[targetFigmaTeam1, targetFigmaTeam2].sort(figmaTeamComparer),
			);
		});

		it('should return empty array when there are no teams with given cloud ID', async () => {
			const targetCloudId = generateCloudId();
			const otherCloudId = generateCloudId();
			await Promise.all([
				figmaTeamRepository.upsert(
					generateFigmaTeamCreateParams({ cloudId: otherCloudId }),
				),
			]);

			const result = await figmaTeamRepository.findManyByCloudId(targetCloudId);

			expect(result).toEqual([]);
		});
	});
});
