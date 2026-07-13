import type { AtlassianUserInfo } from './atlassian-user-info';

export enum FigmaTeamAuthStatus {
	OK = 'OK',
	ERROR = 'ERROR',
}

export class FigmaTeam {
	readonly #adminInfo: AtlassianUserInfo;
	readonly id: string;
	readonly webhookId: string;
	readonly webhookPasscode: string;
	readonly teamId: string;
	readonly teamName: string;
	readonly figmaAdminAtlassianUserId: string;
	readonly authStatus: FigmaTeamAuthStatus;
	readonly cloudId: string;

	constructor(params: {
		id: string;
		webhookId: string;
		webhookPasscode: string;
		teamId: string;
		teamName: string;
		figmaAdminAtlassianUserId: string;
		authStatus: FigmaTeamAuthStatus;
		cloudId: string;
	}) {
		this.id = params.id;
		this.webhookId = params.webhookId;
		this.webhookPasscode = params.webhookPasscode;
		this.teamId = params.teamId;
		this.teamName = params.teamName;
		this.figmaAdminAtlassianUserId = params.figmaAdminAtlassianUserId;
		this.authStatus = params.authStatus;
		this.cloudId = params.cloudId;

		this.#adminInfo = {
			atlassianUserId: this.figmaAdminAtlassianUserId,
			cloudId: this.cloudId,
		};
	}

	get adminInfo() {
		return this.#adminInfo;
	}

	toFigmaTeamSummary(): FigmaTeamSummary {
		return {
			teamId: this.teamId,
			teamName: this.teamName,
			authStatus: this.authStatus,
		};
	}
}

export type FigmaTeamCreateParams = {
	readonly webhookId: string;
	readonly webhookPasscode: string;
	readonly teamId: string;
	readonly teamName: string;
	readonly figmaAdminAtlassianUserId: string;
	readonly authStatus: FigmaTeamAuthStatus;
	readonly cloudId: string;
};

export type FigmaTeamSummary = Pick<
	FigmaTeam,
	'teamId' | 'teamName' | 'authStatus'
>;
