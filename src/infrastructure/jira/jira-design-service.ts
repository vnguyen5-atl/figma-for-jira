import type { SubmitDesignsResponse } from './jira-client';
import { jiraClient } from './jira-client';

import { CauseAwareError } from '../../common/errors';
import type { AtlassianDesign } from '../../domain/entities';

export class JiraDesignService {
	/**
	 * @throws {JiraSubmitDesignServiceError} Design submission fails.
	 */
	submitDesign = async (
		design: AtlassianDesign,
		cloudId: string,
	): Promise<void> => {
		return this.submitDesigns([design], cloudId);
	};

	/**
	 * @throws {JiraSubmitDesignServiceError} Design submission fails.
	 */
	submitDesigns = async (
		designs: AtlassianDesign[],
		cloudId: string,
	): Promise<void> => {
		const response = await jiraClient.submitDesigns({ designs }, cloudId);

		this.throwIfSubmitDesignResponseHasErrors(response);
	};

	/**
	 * @throws {JiraSubmitDesignServiceError}
	 */
	private throwIfSubmitDesignResponseHasErrors = (
		response: SubmitDesignsResponse,
	) => {
		if (response.rejectedEntities.length) {
			const { key, errors } = response.rejectedEntities[0];
			throw JiraSubmitDesignServiceError.designRejected(key.entityId, errors);
		}
	};
}

export const jiraDesignService = new JiraDesignService();

export class JiraSubmitDesignServiceError extends CauseAwareError {
	designId?: string;
	rejectionErrors?: { readonly message: string }[];

	private constructor({
		message,
		designId,
		rejectionErrors,
	}: {
		message: string;
		designId?: string;
		rejectionErrors?: { readonly message: string }[];
	}) {
		super(message);
		this.designId = designId;
		this.rejectionErrors = rejectionErrors;
	}

	static designRejected(
		designId: string,
		rejectionErrors: { readonly message: string }[],
	): JiraSubmitDesignServiceError {
		return new JiraSubmitDesignServiceError({
			message: 'The design submission has been rejected',
			designId,
			rejectionErrors,
		});
	}
}
