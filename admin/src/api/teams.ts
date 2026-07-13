import {
	remoteDelete,
	remoteGetJson,
	remotePostJson,
} from './axiosInstance';

export enum FigmaTeamAuthStatus {
	OK = 'OK',
	ERROR = 'ERROR',
}

export type FigmaTeamSummary = {
	readonly teamId: string;
	readonly teamName: string;
	readonly authStatus: FigmaTeamAuthStatus;
};

export async function getTeams(): Promise<ReadonlyArray<FigmaTeamSummary>> {
	return await remoteGetJson<ReadonlyArray<FigmaTeamSummary>>('/admin/teams');
}

export async function connectTeam(
	teamId: string,
): Promise<Readonly<FigmaTeamSummary>> {
	const result = await remotePostJson<FigmaTeamSummary>(
		`/admin/teams/${teamId}/connect`,
	);
	if (!result) {
		throw new Error('Connect team request returned an empty response.');
	}
	return result;
}

export async function disconnectTeam(teamId: string): Promise<void> {
	await remoteDelete(`/admin/teams/${teamId}/disconnect`);
}
