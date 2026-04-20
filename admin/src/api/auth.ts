import { remoteGetJson } from './axiosInstance';

export type FigmaUser = {
	readonly email: string;
};

export type MeResponseBody = {
	readonly authorizationEndpoint: string;
	readonly user?: FigmaUser;
};

export async function getAuthMe(
	atlassianUserId: string,
): Promise<MeResponseBody> {
	const params = new URLSearchParams({ userId: atlassianUserId });
	return await remoteGetJson<MeResponseBody>(`/admin/auth/me?${params}`);
}
