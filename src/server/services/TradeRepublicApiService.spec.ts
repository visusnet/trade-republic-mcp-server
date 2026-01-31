/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';

import { mockLogger } from '@test/loggerMock';
import type { CryptoManager } from './TradeRepublicApiService.crypto';
import type {
  CredentialsInput,
  TwoFactorCodeInput,
} from './TradeRepublicApiService.request';
import {
  AuthStatus,
  ConnectionStatus,
  type FetchFunction,
  type KeyPair,
  type SignedPayload,
} from './TradeRepublicApiService.types';
import type { WebSocketManager } from './TradeRepublicApiService.websocket';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { TradeRepublicApiService } from './TradeRepublicApiService';

/**
 * Creates a mock CryptoManager for testing.
 */
function createMockCryptoManager(): jest.Mocked<CryptoManager> {
  const mockKeyPair: KeyPair = {
    privateKeyPem:
      '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
  };

  return {
    generateKeyPair: jest
      .fn<() => Promise<KeyPair>>()
      .mockResolvedValue(mockKeyPair),
    saveKeyPair: jest
      .fn<(keyPair: KeyPair) => Promise<void>>()
      .mockResolvedValue(undefined),
    loadKeyPair: jest
      .fn<() => Promise<KeyPair | null>>()
      .mockResolvedValue(null),
    hasStoredKeyPair: jest
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(false),
    sign: jest
      .fn<(message: string, privateKey: string) => string>()
      .mockReturnValue('mock-signature'),
    createSignedPayload: jest
      .fn<(data: object, privateKeyPem: string) => SignedPayload>()
      .mockReturnValue({
        timestamp: new Date().toISOString(),
        data: {},
        signature: 'mock-signature',
      }),
    getPublicKeyBase64: jest
      .fn<(publicKey: string) => string>()
      .mockReturnValue('bW9jay1wdWJsaWMta2V5'),
  } as unknown as jest.Mocked<CryptoManager>;
}

/**
 * Creates a mock WebSocketManager for testing.
 */
function createMockWebSocketManager(): jest.Mocked<WebSocketManager> &
  EventEmitter {
  const emitter = new EventEmitter();

  const mock = {
    connect: jest
      .fn<(token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    disconnect: jest.fn<() => void>(),
    getStatus: jest
      .fn<() => ConnectionStatus>()
      .mockReturnValue(ConnectionStatus.DISCONNECTED),
    subscribe: jest
      .fn<(topic: string, payload?: object) => number>()
      .mockReturnValue(1),
    unsubscribe: jest.fn<(id: number) => void>(),
    on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
      return mock;
    }),
    removeAllListeners: jest.fn(() => {
      emitter.removeAllListeners();
      return mock;
    }),
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
  } as unknown as jest.Mocked<WebSocketManager> & EventEmitter;

  return mock;
}

/**
 * Creates a mock fetch function for testing.
 */
function createMockFetch(): jest.MockedFunction<FetchFunction> {
  return jest.fn<FetchFunction>();
}

describe('TradeRepublicApiService', () => {
  let mockCrypto: jest.Mocked<CryptoManager>;
  let mockWs: jest.Mocked<WebSocketManager> & EventEmitter;
  let mockFetch: jest.MockedFunction<FetchFunction>;
  let service: TradeRepublicApiService;

  const testCredentials: CredentialsInput = {
    phoneNumber: '+491234567890',
    pin: '1234',
  };

  const testTwoFactorCode: TwoFactorCodeInput = {
    code: '5678',
  };

  beforeEach(() => {
    mockCrypto = createMockCryptoManager();
    mockWs = createMockWebSocketManager();
    mockFetch = createMockFetch();
    service = new TradeRepublicApiService(mockCrypto, mockWs, mockFetch);
  });

  describe('initialize', () => {
    it('should load existing key pair if stored', async () => {
      const existingKeyPair: KeyPair = {
        privateKeyPem:
          '-----BEGIN PRIVATE KEY-----\nexisting\n-----END PRIVATE KEY-----',
        publicKeyPem:
          '-----BEGIN PUBLIC KEY-----\nexisting\n-----END PUBLIC KEY-----',
      };
      mockCrypto.hasStoredKeyPair.mockResolvedValue(true);
      mockCrypto.loadKeyPair.mockResolvedValue(existingKeyPair);

      await service.initialize();

      expect(mockCrypto.hasStoredKeyPair).toHaveBeenCalled();
      expect(mockCrypto.loadKeyPair).toHaveBeenCalled();
      expect(mockCrypto.generateKeyPair).not.toHaveBeenCalled();
    });

    it('should generate new key pair if none stored', async () => {
      mockCrypto.hasStoredKeyPair.mockResolvedValue(false);

      await service.initialize();

      expect(mockCrypto.generateKeyPair).toHaveBeenCalled();
      expect(mockCrypto.saveKeyPair).toHaveBeenCalled();
    });

    it('should log initialization status', async () => {
      await service.initialize();

      expect(logger.api.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing'),
      );
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should initiate login and return processId', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      const result = await service.login(testCredentials);

      expect(result.processId).toBe('test-process-id');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should set auth status to AWAITING_2FA after login', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.login(testCredentials);

      expect(service.getAuthStatus()).toBe(AuthStatus.AWAITING_2FA);
    });

    it('should throw on invalid credentials format', async () => {
      const invalidCredentials = { phoneNumber: 'invalid', pin: '123' };

      await expect(
        service.login(invalidCredentials as CredentialsInput),
      ).rejects.toThrow();
    });

    it('should throw on login failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.login(testCredentials)).rejects.toThrow();
    });

    it('should use errorMessage from error response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ errorMessage: 'Error from errorMessage' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.login(testCredentials)).rejects.toThrow(
        'Error from errorMessage',
      );
    });

    it('should use default error message if no error details', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.login(testCredentials)).rejects.toThrow(
        'Login failed',
      );
    });

    it('should use default error message if invalid error response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve('not an object'),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.login(testCredentials)).rejects.toThrow(
        'Login failed',
      );
    });
  });

  describe('verify2FA', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockLoginResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockLoginResponse as Response);
      await service.login(testCredentials);
    });

    it('should complete 2FA and receive tokens', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
    });

    it('should connect WebSocket after successful 2FA', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(mockWs.connect).toHaveBeenCalledWith('test-session-token');
    });

    it('should throw on invalid 2FA code format', async () => {
      await expect(
        service.verify2FA({ code: 'abc' } as TwoFactorCodeInput),
      ).rejects.toThrow();
    });

    it('should throw if not awaiting 2FA', async () => {
      // Create a fresh service without calling login first
      const freshService = new TradeRepublicApiService(
        mockCrypto,
        mockWs,
        mockFetch,
      );
      await freshService.initialize();

      await expect(freshService.verify2FA(testTwoFactorCode)).rejects.toThrow();
    });

    it('should throw on 2FA verification failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid 2FA code' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.verify2FA(testTwoFactorCode)).rejects.toThrow(
        'Invalid 2FA code',
      );
    });

    it('should use errorMessage from 2FA error response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ errorMessage: '2FA error message' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.verify2FA(testTwoFactorCode)).rejects.toThrow(
        '2FA error message',
      );
    });

    it('should use default 2FA error message if no error details', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.verify2FA(testTwoFactorCode)).rejects.toThrow(
        '2FA verification failed',
      );
    });

    it('should use default 2FA error message if error response is invalid', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve('invalid response'),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.verify2FA(testTwoFactorCode)).rejects.toThrow(
        '2FA verification failed',
      );
    });
  });

  describe('refreshSession', () => {
    beforeEach(async () => {
      await service.initialize();
      // Login
      const mockLoginResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockLoginResponse as Response);
      await service.login(testCredentials);
      // 2FA
      const mock2FAResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);
    });

    it('should refresh session token', async () => {
      const mockRefreshResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            sessionToken: 'new-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mockRefreshResponse as Response);

      await service.refreshSession();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/session'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should throw if not authenticated', async () => {
      const freshService = new TradeRepublicApiService(
        mockCrypto,
        mockWs,
        mockFetch,
      );
      await freshService.initialize();

      await expect(freshService.refreshSession()).rejects.toThrow();
    });

    it('should throw on refresh session failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Refresh failed' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.refreshSession()).rejects.toThrow('Refresh failed');
    });

    it('should use errorMessage from refresh error response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ errorMessage: 'Refresh error message' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.refreshSession()).rejects.toThrow(
        'Refresh error message',
      );
    });

    it('should use default refresh error message if no error details', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.refreshSession()).rejects.toThrow(
        'Session refresh failed',
      );
    });

    it('should use default refresh error message if error response is invalid', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve('invalid response'),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.refreshSession()).rejects.toThrow(
        'Session refresh failed',
      );
    });
  });

  describe('ensureValidSession', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockLoginResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockLoginResponse as Response);
      await service.login(testCredentials);
      const mock2FAResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);
    });

    it('should refresh if session is about to expire', async () => {
      // Force session to be expired by manipulating time
      const mockRefreshResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            sessionToken: 'new-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mockRefreshResponse as Response);

      // Mock Date.now to return a time past expiration
      const originalNow = Date.now;
      Date.now = jest.fn(
        () => originalNow() + 60 * 60 * 1000,
      ) as typeof Date.now;

      await service.ensureValidSession();

      // refreshSession should have been called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/session'),
        expect.anything(),
      );

      Date.now = originalNow;
    });

    it('should not refresh if session is still valid', async () => {
      mockFetch.mockClear();

      await service.ensureValidSession();

      // refreshSession should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw if not authenticated', async () => {
      const freshService = new TradeRepublicApiService(
        mockCrypto,
        mockWs,
        mockFetch,
      );
      await freshService.initialize();

      await expect(freshService.ensureValidSession()).rejects.toThrow();
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockLoginResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockLoginResponse as Response);
      await service.login(testCredentials);
      const mock2FAResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);
    });

    it('should unsubscribe from a topic', () => {
      service.unsubscribe(42);

      expect(mockWs.unsubscribe).toHaveBeenCalledWith(42);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      await service.initialize();
      const mockLoginResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockLoginResponse as Response);
      await service.login(testCredentials);
      const mock2FAResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);
    });

    it('should subscribe to a topic', () => {
      mockWs.subscribe.mockReturnValue(42);

      const subId = service.subscribe({
        topic: 'ticker',
        payload: { isin: 'DE0007164600' },
      });

      expect(subId).toBe(42);
      expect(mockWs.subscribe).toHaveBeenCalledWith('ticker', {
        isin: 'DE0007164600',
      });
    });

    it('should subscribe without payload', () => {
      mockWs.subscribe.mockReturnValue(43);

      const subId = service.subscribe({ topic: 'portfolio' });

      expect(subId).toBe(43);
      expect(mockWs.subscribe).toHaveBeenCalledWith('portfolio', undefined);
    });

    it('should throw on invalid subscribe input', () => {
      expect(() => service.subscribe({ topic: '' })).toThrow(
        'Topic cannot be empty',
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clean up', async () => {
      await service.initialize();
      const mockLoginResponse = {
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      };
      mockFetch.mockResolvedValue(mockLoginResponse as Response);
      await service.login(testCredentials);
      const mock2FAResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            refreshToken: 'test-refresh-token',
            sessionToken: 'test-session-token',
          }),
      };
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);

      service.disconnect();

      expect(mockWs.disconnect).toHaveBeenCalled();
      expect(service.getAuthStatus()).toBe(AuthStatus.UNAUTHENTICATED);
    });
  });

  describe('error states', () => {
    it('should throw if login called before initialize', async () => {
      const freshService = new TradeRepublicApiService(
        mockCrypto,
        mockWs,
        mockFetch,
      );

      await expect(freshService.login(testCredentials)).rejects.toThrow();
    });

    it('should emit error events from WebSocket', async () => {
      await service.initialize();
      const errorHandler = jest.fn();
      service.onError(errorHandler);

      const error = new Error('WebSocket error');
      mockWs.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should emit message events from WebSocket', async () => {
      await service.initialize();
      const messageHandler = jest.fn();
      service.onMessage(messageHandler);

      const message = { id: 1, code: 'A', payload: { price: 100 } };
      mockWs.emit('message', message);

      expect(messageHandler).toHaveBeenCalledWith(message);
    });
  });

  describe('getAuthStatus', () => {
    it('should return UNAUTHENTICATED initially', () => {
      expect(service.getAuthStatus()).toBe(AuthStatus.UNAUTHENTICATED);
    });
  });
});
