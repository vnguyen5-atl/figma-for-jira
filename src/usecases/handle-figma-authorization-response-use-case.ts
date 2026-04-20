import { figmaAuthService } from '../infrastructure/figma';

export const handleFigmaAuthorizationResponseUseCase = {
	execute: async (code: string, state: string) => {
		const { atlassianUserId, cloudId } =
			figmaAuthService.verifyOAuth2AuthorizationResponseState(state);

		await figmaAuthService.createCredentials(code, {
			atlassianUserId,
			cloudId,
		});
	},
};
