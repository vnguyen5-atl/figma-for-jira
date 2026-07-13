import { jiraClient } from './jira-client';
import type {
	SubmitDesignsRequest,
	SubmitDesignsResponse,
} from './jira-client/types';

import type {
	AtlassianDesign,
	JiraCallContext,
} from '../../domain/entities';

export class JiraDesignService {
	submitDesign = async (
		design: AtlassianDesign,
		ctx: JiraCallContext,
		associateWithIssueIds: string[] = [],
		disassociateFromIssueIds: string[] = [],
	): Promise<SubmitDesignsResponse> => {
		return await this.submitDesigns(
			[
				{
					...design,
					addAssociations: associateWithIssueIds.map((issueId) => ({
						associationType: 'issueIdOrKeys',
						values: [issueId],
					})),
					removeAssociations: disassociateFromIssueIds.map((issueId) => ({
						associationType: 'issueIdOrKeys',
						values: [issueId],
					})),
				},
			],
			ctx,
		);
	};

	submitDesigns = async (
		designs: SubmitDesignsRequest['designs'],
		ctx: JiraCallContext,
	): Promise<SubmitDesignsResponse> => {
		return await jiraClient.submitDesigns({ designs }, ctx);
	};
}

export const jiraDesignService = new JiraDesignService();
