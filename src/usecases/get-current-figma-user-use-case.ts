import type { FigmaUser } from '../domain/entities';
import { figmaService } from '../infrastructure/figma';

export const getCurrentFigmaUserUseCase = {
	execute: async (
		atlassianUserId: string,
		cloudId: string,
	): Promise<FigmaUser | null> => {
		return await figmaService.getCurrentUser({
			atlassianUserId,
			cloudId,
		});
	},
};
