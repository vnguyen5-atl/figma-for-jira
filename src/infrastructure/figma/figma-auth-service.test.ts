import { encodeSymmetric, SymmetricAlgorithm } from 'atlassian-jwt';
import { v4 as uuidv4 } from 'uuid';

import {
	figmaAuthService,
	MissingOrInvalidCredentialsFigmaAuthServiceError,
} from './figma-auth-service';
import { figmaClient } from './figma-client';
import {
	generateGetOAuth2TokenResponse,
	generateRefreshOAuth2TokenResponse,
} from './figma-client/testing';

import { Duration } from '../../common/duration';
import { getConfig } from '../../config';
import {
	generateCloudId,
	generateAtlassianUserInfo,
	generateFigmaOAuth2UserCredentials,
} from '../../domain/entities/testing';
import { figmaOAuth2UserCredentialsRepository } from '../repositories';

const NOW = Date.now();
const NOW_IN_SECONDS = Math.floor(Date.now() / 1000);
const FIGMA_OAUTH_CODE = uuidv4();

describe('FigmaAuthService', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	describe('createCredentials', () => {
		it('should fetch and store credentials', async () => {
			const connectUserInfo = generateAtlassianUserInfo();
			const getOAuth2TokenResponse = generateGetOAuth2TokenResponse();
			const credentials = generateFigmaOAuth2UserCredentials({
				atlassianUserId: connectUserInfo.atlassianUserId,
				cloudId: connectUserInfo.cloudId,
			});
			jest
				.spyOn(figmaClient, 'getOAuth2Token')
				.mockResolvedValue(getOAuth2TokenResponse);
			jest
				.spyOn(figmaOAuth2UserCredentialsRepository, 'upsert')
				.mockResolvedValue(credentials);

			const result = await figmaAuthService.createCredentials(
				FIGMA_OAUTH_CODE,
				connectUserInfo,
			);

			expect(result).toBe(credentials);
			expect(figmaClient.getOAuth2Token).toHaveBeenCalledWith(FIGMA_OAUTH_CODE);
			expect(figmaOAuth2UserCredentialsRepository.upsert).toHaveBeenCalledWith({
				accessToken: getOAuth2TokenResponse.access_token,
				refreshToken: getOAuth2TokenResponse.refresh_token,
				expiresAt: new Date(
					Date.now() + getOAuth2TokenResponse.expires_in * 1000,
				),
				atlassianUserId: connectUserInfo.atlassianUserId,
				cloudId: connectUserInfo.cloudId,
			});
		});
	});

	describe('getCredentials', () => {
		it('should return credentials when it is not expired', async () => {
			const connectUserInfo = generateAtlassianUserInfo();
			const credentials = generateFigmaOAuth2UserCredentials({
				expiresAt: new Date(
					Date.now() + Duration.ofMinutes(10000).asMilliseconds,
				),
				atlassianUserId: connectUserInfo.atlassianUserId,
				cloudId: connectUserInfo.cloudId,
			});
			jest
				.spyOn(figmaOAuth2UserCredentialsRepository, 'get')
				.mockResolvedValue(credentials);

			const result = await figmaAuthService.getCredentials(connectUserInfo);

			expect(result).toBe(credentials);
			expect(figmaOAuth2UserCredentialsRepository.get).toHaveBeenCalledWith(
				connectUserInfo.atlassianUserId,
				connectUserInfo.cloudId,
			);
		});

		it('should refresh, store and return credentials when it is expired', async () => {
			const now = Date.now();
			jest.setSystemTime(now);

			const connectUserInfo = generateAtlassianUserInfo();
			const credentials = generateFigmaOAuth2UserCredentials({
				expiresAt: new Date(now - Duration.ofMinutes(30).asMilliseconds),
				atlassianUserId: connectUserInfo.atlassianUserId,
				cloudId: connectUserInfo.cloudId,
			});
			const refreshOAuth2TokenResponse = generateRefreshOAuth2TokenResponse();
			const refreshedCredentials = generateFigmaOAuth2UserCredentials({
				id: credentials.id,
				accessToken: refreshOAuth2TokenResponse.access_token,
				refreshToken: credentials.refreshToken,
				expiresAt: new Date(now + refreshOAuth2TokenResponse.expires_in * 1000),
				atlassianUserId: credentials.atlassianUserId,
				cloudId: credentials.cloudId,
			});

			jest
				.spyOn(figmaOAuth2UserCredentialsRepository, 'get')
				.mockResolvedValue(credentials);
			jest
				.spyOn(figmaClient, 'refreshOAuth2Token')
				.mockResolvedValue(refreshOAuth2TokenResponse);
			jest
				.spyOn(figmaOAuth2UserCredentialsRepository, 'upsert')
				.mockResolvedValue(refreshedCredentials);

			const result = await figmaAuthService.getCredentials(connectUserInfo);

			expect(result).toBe(refreshedCredentials);
			expect(figmaOAuth2UserCredentialsRepository.upsert).toHaveBeenCalledWith({
				accessToken: refreshedCredentials.accessToken,
				refreshToken: refreshedCredentials.refreshToken,
				expiresAt: refreshedCredentials.expiresAt,
				atlassianUserId: refreshedCredentials.atlassianUserId,
				cloudId: refreshedCredentials.cloudId,
			});
		});

		it('should throw when no credentials', async () => {
			const connectUserInfo = generateAtlassianUserInfo();
			jest
				.spyOn(figmaOAuth2UserCredentialsRepository, 'get')
				.mockRejectedValue(
					new MissingOrInvalidCredentialsFigmaAuthServiceError('error'),
				);

			await expect(() =>
				figmaAuthService.getCredentials(connectUserInfo),
			).rejects.toBeInstanceOf(
				MissingOrInvalidCredentialsFigmaAuthServiceError,
			);
		});

		it('should throw when refreshing expired credentials fails', async () => {
			const now = Date.now();
			jest.setSystemTime(now);
			const connectUserInfo = generateAtlassianUserInfo();
			const credentials = generateFigmaOAuth2UserCredentials({
				expiresAt: new Date(now - Duration.ofMinutes(30).asMilliseconds),
				atlassianUserId: connectUserInfo.atlassianUserId,
				cloudId: connectUserInfo.cloudId,
			});
			const error = new Error('error');

			jest
				.spyOn(figmaOAuth2UserCredentialsRepository, 'get')
				.mockResolvedValue(credentials);
			jest.spyOn(figmaClient, 'refreshOAuth2Token').mockRejectedValue(error);

			await expect(
				figmaAuthService.getCredentials(connectUserInfo),
			).rejects.toThrowError(MissingOrInvalidCredentialsFigmaAuthServiceError);
		});
	});

	describe('createOAuth2AuthorizationRequest', () => {
		it('should return an authorisation request', () => {
			jest.setSystemTime(NOW);
			const cloudId = generateCloudId();
			const atlassianUserId = uuidv4();
			const redirectUrl = new URL(
				`figma/oauth2/callback`,
				getConfig().app.baseUrl,
			);

			const result = figmaAuthService.createOAuth2AuthorizationRequest({
				atlassianUserId,
				cloudId,
				redirectUrl: redirectUrl,
			});

			const expectedUrl = new URL(
				'/oauth',
				getConfig().figma.oauth2.authorizationServerBaseUrl,
			);
			expectedUrl.search = new URLSearchParams({
				client_id: getConfig().figma.oauth2.clientId,
				redirect_uri: redirectUrl.toString(),
				scope: getConfig().figma.oauth2.scope,
				state: encodeSymmetric(
					{
						iss: cloudId,
						iat: NOW_IN_SECONDS,
						exp: NOW_IN_SECONDS + Duration.ofMinutes(5).asSeconds,
						sub: atlassianUserId,
						aud: [getConfig().app.baseUrl.toString()],
					},
					getConfig().figma.oauth2.stateSecretKey,
					SymmetricAlgorithm.HS256,
				),
				response_type: 'code',
			}).toString();

			expect(result).toBe(expectedUrl.toString());
		});
	});

	describe('createOAuth2AuthorizationRequest', () => {
		it('should return decoded state when state is valid', () => {
			jest.setSystemTime(NOW);
			const cloudId = generateCloudId();
			const atlassianUserId = uuidv4();
			const state = encodeSymmetric(
				{
					iss: cloudId,
					iat: NOW_IN_SECONDS,
					exp: NOW_IN_SECONDS + Duration.ofMinutes(5).asSeconds,
					sub: atlassianUserId,
					aud: [getConfig().app.baseUrl.toString()],
				},
				getConfig().figma.oauth2.stateSecretKey,
				SymmetricAlgorithm.HS256,
			);

			const result =
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state);

			expect(result).toEqual({
				atlassianUserId,
				cloudId,
			});
		});

		it('should throw when state is not a JWT token', () => {
			const state = uuidv4();

			expect(() =>
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state),
			).toThrow();
		});

		it('should throw when token is signed with unexpected key', () => {
			jest.setSystemTime(NOW);
			const cloudId = generateCloudId();
			const atlassianUserId = uuidv4();
			const state = encodeSymmetric(
				{
					iss: cloudId,
					iat: NOW_IN_SECONDS,
					exp: NOW_IN_SECONDS + Duration.ofMinutes(5).asSeconds,
					sub: atlassianUserId,
					aud: [getConfig().app.baseUrl],
				},
				uuidv4(),
				SymmetricAlgorithm.HS256,
			);

			expect(() =>
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state),
			).toThrow();
		});

		it('should throw when `iss` claim is invalid', () => {
			jest.setSystemTime(NOW);
			const atlassianUserId = uuidv4();
			const state = encodeSymmetric(
				{
					iss: '',
					iat: NOW_IN_SECONDS,
					exp: NOW_IN_SECONDS + Duration.ofMinutes(5).asSeconds,
					sub: atlassianUserId,
					aud: [getConfig().app.baseUrl],
				},
				getConfig().figma.oauth2.stateSecretKey,
				SymmetricAlgorithm.HS256,
			);

			expect(() =>
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state),
			).toThrow();
		});

		it('should throw when `sub` claim is invalid', () => {
			jest.setSystemTime(NOW);
			const cloudId = generateCloudId();
			const state = encodeSymmetric(
				{
					iss: cloudId,
					iat: NOW_IN_SECONDS,
					exp: NOW_IN_SECONDS + Duration.ofMinutes(5).asSeconds,
					sub: '',
					aud: [getConfig().app.baseUrl],
				},
				getConfig().figma.oauth2.stateSecretKey,
				SymmetricAlgorithm.HS256,
			);

			expect(() =>
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state),
			).toThrow();
		});

		it('should throw when `aud` claim does not contain app base URL', () => {
			jest.setSystemTime(NOW);
			const cloudId = generateCloudId();
			const atlassianUserId = uuidv4();
			const state = encodeSymmetric(
				{
					iss: cloudId,
					iat: NOW_IN_SECONDS,
					exp: NOW_IN_SECONDS + Duration.ofMinutes(5).asSeconds,
					sub: atlassianUserId,
					aud: [`https://${uuidv4()}.com`],
				},
				getConfig().figma.oauth2.stateSecretKey,
				SymmetricAlgorithm.HS256,
			);

			expect(() =>
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state),
			).toThrow();
		});

		it('should throw when token is expired', () => {
			jest.setSystemTime(NOW);
			const cloudId = generateCloudId();
			const atlassianUserId = uuidv4();
			const state = encodeSymmetric(
				{
					iss: cloudId,
					iat: NOW_IN_SECONDS,
					exp: NOW_IN_SECONDS - Duration.ofMinutes(1).asSeconds,
					sub: atlassianUserId,
					aud: [getConfig().app.baseUrl],
				},
				getConfig().figma.oauth2.stateSecretKey,
				SymmetricAlgorithm.HS256,
			);

			expect(() =>
				figmaAuthService.verifyOAuth2AuthorizationResponseState(state),
			).toThrow();
		});
	});
});
