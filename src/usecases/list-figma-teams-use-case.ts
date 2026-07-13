import type { FigmaTeamSummary } from '../domain/entities';
import { figmaTeamRepository } from '../infrastructure/repositories';

export const listFigmaTeamsUseCase = {
	execute: async (cloudId: string): Promise<FigmaTeamSummary[]> => {
		return figmaTeamRepository.findManySummaryByCloudId(cloudId);
	},
};
