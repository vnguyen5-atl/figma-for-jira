import { v4 as uuidv4 } from 'uuid';

import type {
	AssociatedFigmaDesign,
	AssociatedFigmaDesignCreateParams,
	AtlassianDesign,
	ConnectUserInfo,
	FigmaFileWebhook,
	FigmaOAuth2UserCredentialsCreateParams,
	FigmaTeamCreateParams,
	FigmaTeamSummary,
	JiraIssue,
} from '..';
import {
	AtlassianDesignStatus,
	AtlassianDesignType,
	FigmaDesignIdentifier,
	FigmaFileWebhookEventType,
	FigmaOAuth2UserCredentials,
	FigmaTeam,
	FigmaTeamAuthStatus,
} from '..';
import { Duration } from '../../../common/duration';
import {
	generateNumericStringId,
	getRandomInt,
} from '../../../common/testing/utils';

/**
 * Generates a Forge-style cloud ID (a UUID identifying a Jira site).
 */
export const generateCloudId = () => uuidv4();

export const generateJiraCallContext = ({
	cloudId = generateCloudId(),
	apiBaseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`,
	appSystemToken = 'test-app-system-token',
}: {
	cloudId?: string;
	apiBaseUrl?: string;
	appSystemToken?: string;
} = {}) => ({
	cloudId,
	apiBaseUrl,
	appSystemToken,
});

export const generateFigmaFileName = () => uuidv4();

export const generateFigmaFileKey = () =>
	Buffer.from(uuidv4()).toString('base64');

export const generateFigmaNodeId = () =>
	`${getRandomInt(1, 1000)}:${getRandomInt(1, 1000)}`;

export const generateFigmaDesignIdentifier = ({
	fileKey = generateFigmaFileKey(),
	nodeId = undefined,
}: {
	fileKey?: string;
	nodeId?: string;
} = {}) => new FigmaDesignIdentifier(fileKey, nodeId);

export const generateFigmaDesignUrl = ({
	fileKey = generateFigmaFileKey(),
	nodeId,
	mode,
}: {
	fileKey?: string;
	nodeId?: string;
	mode?: string;
} = {}): URL => {
	const url = new URL(`https://www.figma.com/file/${fileKey}`);
	if (nodeId) {
		url.searchParams.append('node-id', nodeId);
	}
	if (mode) {
		url.searchParams.append('mode', mode);
	}

	return url;
};

export const generateFigmaOAuth2UserCredentialCreateParams = ({
	atlassianUserId = uuidv4(),
	accessToken = uuidv4(),
	refreshToken = uuidv4(),
	expiresAt = new Date(Date.now() + Duration.ofMinutes(120).asMilliseconds),
	cloudId = generateCloudId(),
} = {}): FigmaOAuth2UserCredentialsCreateParams => ({
	atlassianUserId,
	accessToken,
	refreshToken,
	expiresAt,
	cloudId,
});

export const generateExpiredFigmaOAuth2UserCredentialCreateParams = ({
	atlassianUserId = uuidv4(),
	accessToken = uuidv4(),
	refreshToken = uuidv4(),
	cloudId = generateCloudId(),
} = {}): FigmaOAuth2UserCredentialsCreateParams => ({
	atlassianUserId,
	accessToken,
	refreshToken,
	expiresAt: new Date(Date.now() - Duration.ofMinutes(120).asMilliseconds),
	cloudId,
});

export const generateFigmaOAuth2UserCredentials = ({
	id = generateNumericStringId(),
	atlassianUserId = uuidv4(),
	accessToken = uuidv4(),
	refreshToken = uuidv4(),
	expiresAt = new Date(),
	cloudId = generateCloudId(),
} = {}): FigmaOAuth2UserCredentials =>
	new FigmaOAuth2UserCredentials(
		id,
		atlassianUserId,
		accessToken,
		refreshToken,
		expiresAt,
		cloudId,
	);

export const generateConnectUserInfo = ({
	atlassianUserId = uuidv4(),
	cloudId = generateCloudId(),
} = {}): ConnectUserInfo => ({
	atlassianUserId,
	cloudId,
});

export const generateAtlassianDesign = ({
	id = `${generateFigmaFileKey()}/${generateFigmaNodeId()}`,
	displayName = `Design ${uuidv4()}`,
	url = generateFigmaDesignUrl({
		fileKey: FigmaDesignIdentifier.fromAtlassianDesignId(id).fileKey,
		nodeId: FigmaDesignIdentifier.fromAtlassianDesignId(id).nodeId,
	}).toString(),
	liveEmbedUrl = generateFigmaDesignUrl({
		fileKey: FigmaDesignIdentifier.fromAtlassianDesignId(id).fileKey,
		nodeId: FigmaDesignIdentifier.fromAtlassianDesignId(id).nodeId,
		mode: 'design',
	}).toString(),
	status = AtlassianDesignStatus.UNKNOWN,
	type = AtlassianDesignType.FILE,
	lastUpdated = new Date().toISOString(),
	updateSequenceNumber = Date.now(),
} = {}): AtlassianDesign => ({
	id,
	displayName,
	url,
	liveEmbedUrl,
	status,
	type,
	lastUpdated,
	updateSequenceNumber,
});

export const generateJiraIssueId = () => generateNumericStringId();

export const generateJiraIssueKey = () => `KEY-${generateNumericStringId()}`;

export const generateJiraIssueUrl = ({
	baseUrl = `https://${uuidv4()}.atlassian.net`,
	key = generateJiraIssueKey(),
} = {}) => new URL(`browse/${key}`, baseUrl);

export const generateJiraIssueAri = ({
	cloudId = uuidv4(),
	issueId = generateJiraIssueId(),
} = {}) => `ari:cloud:jira:${cloudId}:issue/${issueId}`;

export const generateJiraIssue = ({
	id = generateJiraIssueId(),
	key = generateJiraIssueKey(),
	self = generateJiraIssueUrl({ key }).toString(),
	fields = {
		summary: `Issue ${key}`,
	},
} = {}): JiraIssue => ({
	id,
	key,
	self,
	fields,
});

export const generateAssociatedFigmaDesignCreateParams = ({
	designId = generateFigmaDesignIdentifier(),
	associatedWithAri = generateJiraIssueAri(),
	cloudId = generateCloudId(),
}: Partial<AssociatedFigmaDesignCreateParams> = {}): AssociatedFigmaDesignCreateParams => ({
	designId,
	associatedWithAri,
	cloudId,
});

export const generateAssociatedFigmaDesign = ({
	id = generateNumericStringId(),
	designId = generateFigmaDesignIdentifier(),
	associatedWithAri = generateJiraIssueAri(),
	inputUrl = generateFigmaDesignUrl(designId).toString(),
	cloudId = generateCloudId(),
}: Partial<AssociatedFigmaDesign> = {}): AssociatedFigmaDesign => ({
	id,
	designId,
	associatedWithAri,
	cloudId,
	inputUrl,
});

export const generateFigmaTeamCreateParams = ({
	webhookId = uuidv4(),
	webhookPasscode = uuidv4(),
	teamId = uuidv4(),
	teamName = uuidv4(),
	figmaAdminAtlassianUserId = uuidv4(),
	authStatus: status = FigmaTeamAuthStatus.OK,
	cloudId = generateCloudId(),
}: Partial<FigmaTeamCreateParams> = {}): FigmaTeamCreateParams => ({
	webhookId,
	webhookPasscode,
	teamId,
	teamName,
	figmaAdminAtlassianUserId,
	authStatus: status,
	cloudId,
});

export const generateFigmaTeam = ({
	id = generateNumericStringId(),
	webhookId = uuidv4(),
	webhookPasscode = uuidv4(),
	teamId = uuidv4(),
	teamName = uuidv4(),
	figmaAdminAtlassianUserId = uuidv4(),
	authStatus = FigmaTeamAuthStatus.OK,
	cloudId = generateCloudId(),
}: Partial<FigmaTeam> = {}): FigmaTeam =>
	new FigmaTeam({
		id,
		webhookId,
		webhookPasscode,
		teamId,
		teamName,
		figmaAdminAtlassianUserId,
		authStatus,
		cloudId,
	});

export const generateFigmaTeamSummary = ({
	teamId = uuidv4(),
	teamName = uuidv4(),
	authStatus: status = FigmaTeamAuthStatus.OK,
}: Partial<FigmaTeamSummary> = {}): FigmaTeamSummary => ({
	teamId,
	teamName,
	authStatus: status,
});

export const generateFigmaFileWebhook = ({
	id = generateNumericStringId(),
	webhookId = uuidv4(),
	webhookPasscode = uuidv4(),
	fileKey = generateFigmaFileKey(),
	eventType = FigmaFileWebhookEventType.FILE_UPDATE,
	createdBy = {
		atlassianUserId: uuidv4(),
		cloudId: generateCloudId(),
	},
}: Partial<FigmaFileWebhook> = {}): FigmaFileWebhook => {
	return {
		id,
		webhookId,
		webhookPasscode,
		fileKey,
		eventType,
		createdBy,
	};
};
