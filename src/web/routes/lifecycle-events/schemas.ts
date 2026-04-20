import type { UninstalledForgeLifecycleEventRequestBody } from './types';

import type { JSONSchemaTypeWithId } from '../../../common/schema-validation';

export const UNINSTALLED_FORGE_LIFECYCLE_EVENT_REQUEST_SCHEMA: JSONSchemaTypeWithId<{
	body: UninstalledForgeLifecycleEventRequestBody;
}> = {
	$id: 'figma-for-jira-api:post:lifecycleEvents/uninstalled:request',
	type: 'object',
	properties: {
		body: {
			type: 'object',
			properties: {
				cloudId: { type: 'string', minLength: 1 },
			},
			required: ['cloudId'],
		},
	},
	required: ['body'],
};
