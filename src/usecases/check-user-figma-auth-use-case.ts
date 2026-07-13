import { figmaService } from '../infrastructure/figma';

export const checkUserFigmaAuthUseCase = {
	execute: async (
		atlassianUserId: string,
		cloudId: string,
	): Promise<boolean> => {
		const currentUser = await figmaService.getCurrentUser({
			atlassianUserId,
			cloudId,
		});

		return currentUser != null;
	},
};
