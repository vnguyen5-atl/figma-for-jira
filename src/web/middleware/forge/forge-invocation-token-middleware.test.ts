import type { Request, Response } from 'express';

import { forgeInvocationTokenMiddleware } from './forge-invocation-token-middleware';
import { forgeInvocationTokenVerifier } from './forge-invocation-token-verifier';

import { flushMacrotaskQueue } from '../../../common/testing/utils';
import { UnauthorizedResponseStatusError } from '../../errors';

const TEST_APP_ID = 'ari:cloud:ecosystem::app/test-app-id';
const TEST_CLOUD_ID = 'test-cloud-id';
const TEST_ACCOUNT_ID = 'test-account-id';
const TEST_TOKEN = 'test.forge.token';

jest.mock('../../../config', () => ({
	getConfig: () => ({
		app: { id: TEST_APP_ID },
	}),
}));

describe('forgeInvocationTokenMiddleware', () => {
	it('should authenticate a valid token and populate res.locals', async () => {
		const request = {
			headers: { authorization: `Bearer ${TEST_TOKEN}` },
		} as Request;
		const locals: Record<string, unknown> = {};
		const response = { locals } as unknown as Response;
		const next = jest.fn();

		jest.spyOn(forgeInvocationTokenVerifier, 'verify').mockResolvedValue({
			iss: 'forge/invocation-token',
			aud: TEST_APP_ID,
			cloudId: TEST_CLOUD_ID,
			accountId: TEST_ACCOUNT_ID,
			isAdminUser: true,
			apiBaseUrl: `https://api.atlassian.com/ex/jira/${TEST_CLOUD_ID}`,
			installationId: 'test-installation-id',
			exp: 9999999999,
			iat: 0,
		});

		forgeInvocationTokenMiddleware(request, response, next);
		await flushMacrotaskQueue();

		expect(forgeInvocationTokenVerifier.verify).toHaveBeenCalledWith(
			TEST_TOKEN,
			TEST_APP_ID,
		);
		expect(locals.cloudId).toBe(TEST_CLOUD_ID);
		expect(locals.accountId).toBe(TEST_ACCOUNT_ID);
		expect(locals.isAdminUser).toBe(true);
		expect(next).toHaveBeenCalledWith();
	});

	it('should call next with UnauthorizedResponseStatusError for an invalid token', async () => {
		const request = {
			headers: { authorization: `Bearer ${TEST_TOKEN}` },
		} as Request;
		const response = { locals: {} } as unknown as Response;
		const next = jest.fn();
		const error = new Error('invalid token');

		jest.spyOn(forgeInvocationTokenVerifier, 'verify').mockRejectedValue(error);

		forgeInvocationTokenMiddleware(request, response, next);
		await flushMacrotaskQueue();

		expect(next).toHaveBeenCalledWith(
			new UnauthorizedResponseStatusError('Unauthorized.', undefined, error),
		);
	});

	it('should call next with UnauthorizedResponseStatusError when Authorization header is missing', async () => {
		const request = { headers: {} } as Request;
		const response = { locals: {} } as unknown as Response;
		const next = jest.fn();

		forgeInvocationTokenMiddleware(request, response, next);
		await flushMacrotaskQueue();

		expect(next).toHaveBeenCalledWith(
			new UnauthorizedResponseStatusError('Missing Forge Invocation Token.'),
		);
	});

	it('should call next with UnauthorizedResponseStatusError when Bearer prefix is missing', async () => {
		const request = {
			headers: { authorization: TEST_TOKEN }, // no "Bearer " prefix
		} as Request;
		const response = { locals: {} } as unknown as Response;
		const next = jest.fn();

		forgeInvocationTokenMiddleware(request, response, next);
		await flushMacrotaskQueue();

		expect(next).toHaveBeenCalledWith(
			new UnauthorizedResponseStatusError('Missing Forge Invocation Token.'),
		);
	});
});
