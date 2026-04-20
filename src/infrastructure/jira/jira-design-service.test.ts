import { jiraClient } from './jira-client';
import {
	generateFailedSubmitDesignsResponse,
	generateSuccessfulSubmitDesignsResponse,
} from './jira-client/testing';
import {
	jiraDesignService,
	JiraSubmitDesignServiceError,
} from './jira-design-service';

import {
	generateAtlassianDesign,
	generateCloudId,
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
			const cloudId = generateCloudId();
			const designs = [generateAtlassianDesign(), generateAtlassianDesign()];
			const submitDesignsResponse = generateSuccessfulSubmitDesignsResponse(
				designs.map((design) => design.id),
			);
			jest
				.spyOn(jiraClient, 'submitDesigns')
				.mockResolvedValue(submitDesignsResponse);

			await jiraDesignService.submitDesigns(designs, cloudId);

			expect(jiraClient.submitDesigns).toHaveBeenCalledWith(
				{ designs },
				cloudId,
			);
		});

		it('should throw when design is rejected ', async () => {
			const cloudId = generateCloudId();
			const designs = [generateAtlassianDesign(), generateAtlassianDesign()];
			const submitDesignsResponse = generateFailedSubmitDesignsResponse(
				designs.map((design) => design.id),
			);
			const expectedError = JiraSubmitDesignServiceError.designRejected(
				submitDesignsResponse.rejectedEntities[0].key.entityId,
				submitDesignsResponse.rejectedEntities[0].errors,
			);
			jest
				.spyOn(jiraClient, 'submitDesigns')
				.mockResolvedValue(submitDesignsResponse);

			await expect(() =>
				jiraDesignService.submitDesigns(designs, cloudId),
			).rejects.toStrictEqual(expectedError);
		});
	});

	describe('submitDesign', () => {
		it('should call submitDesigns', async () => {
			const cloudId = generateCloudId();
			const design = generateAtlassianDesign();

			jest
				.spyOn(jiraDesignService, 'submitDesigns')
				.mockResolvedValue(undefined);

			await jiraDesignService.submitDesign(design, cloudId);

			expect(jiraDesignService.submitDesigns).toHaveBeenCalledWith(
				[design],
				cloudId,
			);
		});
	});
});
