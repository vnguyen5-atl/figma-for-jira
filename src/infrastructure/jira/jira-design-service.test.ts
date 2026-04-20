import { jiraClient } from './jira-client';
import { generateSuccessfulSubmitDesignsResponse } from './jira-client/testing';
import { jiraDesignService } from './jira-design-service';

import {
	generateAtlassianDesign,
	generateJiraCallContext,
} from '../../domain/entities/testing';

describe('JiraDesignService', () => {
	describe('submitDesigns', () => {
		const currentDate = new Date();

		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(currentDate);
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should submit designs', async () => {
			const jiraCallContext = generateJiraCallContext();
			const designs = [generateAtlassianDesign(), generateAtlassianDesign()];
			const submitDesignsResponse = generateSuccessfulSubmitDesignsResponse(
				designs.map((design) => design.id),
			);
			jest
				.spyOn(jiraClient, 'submitDesigns')
				.mockResolvedValue(submitDesignsResponse);

			await jiraDesignService.submitDesigns(designs, jiraCallContext);

			expect(jiraClient.submitDesigns).toHaveBeenCalledWith(
				{ designs },
				jiraCallContext,
			);
		});
	});

	describe('submitDesign', () => {
		it('should call submitDesigns', async () => {
			const jiraCallContext = generateJiraCallContext();
			const design = generateAtlassianDesign();
			const submitDesignsResponse = generateSuccessfulSubmitDesignsResponse([
				design.id,
			]);

			jest
				.spyOn(jiraDesignService, 'submitDesigns')
				.mockResolvedValue(submitDesignsResponse);

			await jiraDesignService.submitDesign(design, jiraCallContext);

			expect(jiraDesignService.submitDesigns).toHaveBeenCalledWith(
				[
					{
						...design,
						addAssociations: [],
						removeAssociations: [],
					},
				],
				jiraCallContext,
			);
		});
	});
});
