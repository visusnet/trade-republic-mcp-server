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

/**
 * Creates a mock Response with Set-Cookie headers for cookie-based auth.
 */
function createMock2FAResponse(
  cookies: string[] = ['session=test-session-cookie; Domain=traderepublic.com'],
): Partial<Response> {
  const headers = new Map<string, string>();
  if (cookies.length > 0) {
    headers.set('set-cookie', cookies.join(', '));
  }
  return {
    ok: true,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
      getSetCookie: () => cookies,
    } as unknown as Headers,
    json: () => Promise.resolve({}),
  };
}

/**
 * Creates a mock Response for refresh session with optional new cookies.
 */
function createMockRefreshResponse(cookies: string[] = []): Partial<Response> {
  const headers = new Map<string, string>();
  if (cookies.length > 0) {
    headers.set('set-cookie', cookies.join(', '));
  }
  return {
    ok: true,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
      getSetCookie: () => cookies,
    } as unknown as Headers,
    json: () => Promise.resolve({}),
  };
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

    it('should complete 2FA and store cookies', async () => {
      const mockResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
    });

    it('should connect WebSocket with cookie header after successful 2FA', async () => {
      const mockResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      // WebSocket should receive cookie header string, not session token
      expect(mockWs.connect).toHaveBeenCalledWith(
        'session=test-session-cookie',
      );
    });

    it('should throw if no cookies received in 2FA response', async () => {
      const mockResponse = createMock2FAResponse([]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.verify2FA(testTwoFactorCode)).rejects.toThrow(
        'No cookies received from 2FA response',
      );
    });

    it('should handle response with no headers', async () => {
      const mockResponse = {
        ok: true,
        headers: undefined,
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      await expect(service.verify2FA(testTwoFactorCode)).rejects.toThrow(
        'No cookies received from 2FA response',
      );
    });

    it('should parse cookies using headers.get fallback', async () => {
      // Mock response without getSetCookie, only get method
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'set-cookie'
              ? 'session=fallback-cookie; Domain=traderepublic.com'
              : null,
          // No getSetCookie function
        },
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(mockWs.connect).toHaveBeenCalledWith('session=fallback-cookie');
    });

    it('should parse multiple cookies from comma-separated set-cookie header', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'set-cookie'
              ? 'session=cookie1; Domain=traderepublic.com, refresh=cookie2; Domain=traderepublic.com'
              : null,
        },
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(mockWs.connect).toHaveBeenCalledWith(
        'session=cookie1; refresh=cookie2',
      );
    });

    it('should ignore malformed cookies (no equals sign)', async () => {
      const mockResponse = createMock2FAResponse([
        'malformed-cookie-without-equals',
        'session=valid-cookie; Domain=traderepublic.com',
      ]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(mockWs.connect).toHaveBeenCalledWith('session=valid-cookie');
    });

    it('should ignore cookies with empty name', async () => {
      const mockResponse = createMock2FAResponse([
        '=empty-name; Domain=traderepublic.com',
        'session=valid-cookie; Domain=traderepublic.com',
      ]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(mockWs.connect).toHaveBeenCalledWith('session=valid-cookie');
    });

    it('should parse cookie with expires attribute', async () => {
      const expiresDate = 'Wed, 21 Oct 2025 07:28:00 GMT';
      const mockResponse = createMock2FAResponse([
        `session=test-cookie; Domain=traderepublic.com; Expires=${expiresDate}`,
      ]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
    });

    it('should handle cookie with leading dot in domain', async () => {
      const mockResponse = createMock2FAResponse([
        'session=test-cookie; Domain=.traderepublic.com',
      ]);
      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.verify2FA(testTwoFactorCode);

      expect(mockWs.connect).toHaveBeenCalledWith('session=test-cookie');
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
      // 2FA with cookies
      const mock2FAResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);
    });

    it('should refresh session using GET with cookies', async () => {
      const mockRefreshResponse = createMockRefreshResponse([
        'session=new-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mockRefreshResponse as Response);

      await service.refreshSession();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/session'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Cookie: 'session=test-session-cookie',
          }),
        }),
      );
    });

    it('should update cookies from refresh response if provided', async () => {
      const mockRefreshResponse = createMockRefreshResponse([
        'session=refreshed-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mockRefreshResponse as Response);

      await service.refreshSession();

      // Clear mock and refresh again to verify new cookie is used
      mockFetch.mockClear();
      mockFetch.mockResolvedValue(createMockRefreshResponse() as Response);

      await service.refreshSession();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/session'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'session=refreshed-session-cookie',
          }),
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
      const mock2FAResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mock2FAResponse as Response);
      await service.verify2FA(testTwoFactorCode);
    });

    it('should refresh if session is about to expire', async () => {
      // Force session to be expired by manipulating time
      const mockRefreshResponse = createMockRefreshResponse();
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
      const mock2FAResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
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
      const mock2FAResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
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
      const mock2FAResponse = createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
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

  describe('offMessage', () => {
    it('should remove a registered message handler', async () => {
      await service.initialize();
      const handler = jest.fn();
      service.onMessage(handler);
      service.offMessage(handler);

      const message = { id: 1, code: 'A', payload: { test: true } };
      mockWs.emit('message', message);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should do nothing if handler not found', async () => {
      await service.initialize();
      const handler = jest.fn();
      expect(() => {
        service.offMessage(handler);
      }).not.toThrow();
    });
  });

  describe('offError', () => {
    it('should remove a registered error handler', async () => {
      await service.initialize();
      const handler = jest.fn();
      service.onError(handler);
      service.offError(handler);

      const error = new Error('Test error');
      mockWs.emit('error', error);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should do nothing if handler not found', async () => {
      await service.initialize();
      const handler = jest.fn();
      expect(() => {
        service.offError(handler);
      }).not.toThrow();
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle rapid HTTP requests to max 1 per second', async () => {
      await service.initialize();

      // Track when each fetch call was made
      const fetchCallTimes: number[] = [];

      // Login response
      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ processId: 'test-process-id' }),
        } as Response);
      });

      // Make two rapid login requests
      const p1 = service.login(testCredentials);
      const p2 = service.login(testCredentials);

      // Advance timers to allow both requests to complete
      await jest.advanceTimersByTimeAsync(2000);

      await Promise.all([p1, p2]);

      // Both calls should have been made
      expect(fetchCallTimes).toHaveLength(2);

      // Second request should be delayed by at least 1000ms
      expect(fetchCallTimes[1] - fetchCallTimes[0]).toBeGreaterThanOrEqual(
        1000,
      );
    });

    it('should throttle across different HTTP methods (login, verify2FA, refreshSession)', async () => {
      await service.initialize();

      const fetchCallTimes: number[] = [];
      let callIndex = 0;

      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        callIndex++;

        // First call: login response
        if (callIndex === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ processId: 'test-process-id' }),
          } as Response);
        }

        // Second call: 2FA response with cookies
        if (callIndex === 2) {
          return Promise.resolve({
            ok: true,
            headers: {
              get: (name: string) =>
                name.toLowerCase() === 'set-cookie'
                  ? 'session=test-cookie; Domain=traderepublic.com'
                  : null,
              getSetCookie: () => [
                'session=test-cookie; Domain=traderepublic.com',
              ],
            } as unknown as Headers,
            json: () => Promise.resolve({}),
          } as Response);
        }

        // Third call: refresh session response
        return Promise.resolve({
          ok: true,
          headers: {
            get: () => null,
            getSetCookie: () => [],
          } as unknown as Headers,
          json: () => Promise.resolve({}),
        } as Response);
      });

      // Start login
      const loginPromise = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(1000);
      await loginPromise;

      // Start 2FA verification
      const verify2FAPromise = service.verify2FA({ code: '1234' });
      await jest.advanceTimersByTimeAsync(1000);
      await verify2FAPromise;

      // Start refresh session
      const refreshPromise = service.refreshSession();
      await jest.advanceTimersByTimeAsync(1000);
      await refreshPromise;

      // All three calls should have been made
      expect(fetchCallTimes).toHaveLength(3);

      // Each call should be spaced at least 1000ms apart
      expect(fetchCallTimes[1] - fetchCallTimes[0]).toBeGreaterThanOrEqual(
        1000,
      );
      expect(fetchCallTimes[2] - fetchCallTimes[1]).toBeGreaterThanOrEqual(
        1000,
      );
    });

    it('should allow immediate request if previous request was more than 1 second ago', async () => {
      await service.initialize();

      const fetchCallTimes: number[] = [];

      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ processId: 'test-process-id' }),
        } as Response);
      });

      // Make first request
      const p1 = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(100);
      await p1;

      const firstRequestTime = fetchCallTimes[0];

      // Wait for more than 1 second
      await jest.advanceTimersByTimeAsync(1500);

      // Make second request - should execute immediately (not delayed)
      const p2 = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(100);
      await p2;

      expect(fetchCallTimes).toHaveLength(2);

      // Second request should have been made after ~1600ms (100 + 1500 + 0)
      // The interval between the actual fetch calls should be >= 1500ms
      expect(fetchCallTimes[1] - firstRequestTime).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('exponential backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry on 500 server error up to 3 times then fail', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Internal server error' }),
        } as Response);
      });

      // Start the login and advance timers concurrently
      const loginPromise = service
        .login(testCredentials)
        .catch((e: unknown) => e as Error);

      // Advance through all retry attempts with backoff delays
      // 1st attempt: immediate
      // 2nd attempt: after 1s delay
      // 3rd attempt: after 2s delay
      // 4th attempt: after 4s delay (final failure)
      await jest.advanceTimersByTimeAsync(10000);

      const result = await loginPromise;
      expect(result).toBeInstanceOf(Error);
      expect(callCount).toBe(4); // Initial + 3 retries
    });

    it('should retry on 429 rate limit error', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({ message: 'Rate limited' }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ processId: 'test-process-id' }),
        } as Response);
      });

      const loginPromise = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await loginPromise;
      expect(result.processId).toBe('test-process-id');
      expect(callCount).toBe(2); // Initial failed, then success
    });

    it('should NOT retry on 400 client error', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: 'Bad request' }),
        } as Response);
      });

      const loginPromise = service
        .login(testCredentials)
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await loginPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Bad request');
      expect(callCount).toBe(1); // No retries
    });

    it('should NOT retry on 401 unauthorized error', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Invalid credentials' }),
        } as Response);
      });

      const loginPromise = service
        .login(testCredentials)
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await loginPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Invalid credentials');
      expect(callCount).toBe(1); // No retries
    });

    it('should retry on network error', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('ECONNRESET');
          (error as NodeJS.ErrnoException).code = 'ECONNRESET';
          return Promise.reject(error);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ processId: 'test-process-id' }),
        } as Response);
      });

      const loginPromise = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await loginPromise;
      expect(result.processId).toBe('test-process-id');
      expect(callCount).toBe(2); // Initial failed, then success
    });

    it('should succeed after transient 500 failure', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Temporary failure' }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ processId: 'test-process-id' }),
        } as Response);
      });

      const loginPromise = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await loginPromise;
      expect(result.processId).toBe('test-process-id');
      expect(callCount).toBe(2);
    });

    it('should log retry attempts', async () => {
      await service.initialize();

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Server error' }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ processId: 'test-process-id' }),
        } as Response);
      });

      const loginPromise = service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(10000);

      await loginPromise;

      expect(logger.api.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: expect.any(Number),
          retriesLeft: expect.any(Number),
        }),
        expect.stringContaining('retrying'),
      );
    });

    it('should retry 2FA verification on 503 service unavailable', async () => {
      await service.initialize();

      // First login successfully
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      } as Response);

      await service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(1000);

      // Then 2FA with retry
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ message: 'Service unavailable' }),
          } as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-cookie; Domain=traderepublic.com',
          ]) as Response,
        );
      });

      const verify2FAPromise = service.verify2FA(testTwoFactorCode);
      await jest.advanceTimersByTimeAsync(10000);

      await verify2FAPromise;
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
      expect(callCount).toBe(2);
    });

    it('should retry refreshSession on 502 bad gateway', async () => {
      await service.initialize();

      // Setup authenticated state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processId: 'test-process-id' }),
      } as Response);
      await service.login(testCredentials);
      await jest.advanceTimersByTimeAsync(1000);

      mockFetch.mockResolvedValueOnce(
        createMock2FAResponse([
          'session=test-cookie; Domain=traderepublic.com',
        ]) as Response,
      );
      await service.verify2FA(testTwoFactorCode);
      await jest.advanceTimersByTimeAsync(1000);

      // Now test refresh with retry
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 502,
            json: () => Promise.resolve({ message: 'Bad gateway' }),
          } as Response);
        }
        return Promise.resolve(createMockRefreshResponse() as Response);
      });

      const refreshPromise = service.refreshSession();
      await jest.advanceTimersByTimeAsync(10000);

      await refreshPromise;
      expect(callCount).toBe(2);
    });

    it('should respect exponential backoff timing (1s, 2s, 4s delays)', async () => {
      await service.initialize();

      const fetchCallTimes: number[] = [];
      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        } as Response);
      });

      const loginPromise = service
        .login(testCredentials)
        .catch((e: unknown) => e as Error);

      // Wait for all retries to complete
      await jest.advanceTimersByTimeAsync(20000);

      const result = await loginPromise;
      expect(result).toBeInstanceOf(Error);

      // Verify exponential backoff delays (approximately)
      // First retry after ~1000ms, second after ~2000ms, third after ~4000ms
      expect(fetchCallTimes.length).toBe(4);

      // The delays between calls should be exponentially increasing
      // With rate limiting, each call is at least 1s apart, plus backoff
      const delay1 = fetchCallTimes[1] - fetchCallTimes[0];
      const delay2 = fetchCallTimes[2] - fetchCallTimes[1];
      const delay3 = fetchCallTimes[3] - fetchCallTimes[2];

      // Minimum delays should follow exponential pattern
      expect(delay1).toBeGreaterThanOrEqual(1000); // At least 1s (minTimeout)
      expect(delay2).toBeGreaterThanOrEqual(2000); // At least 2s (factor 2)
      expect(delay3).toBeGreaterThanOrEqual(4000); // At least 4s (factor 2)
    });
  });
});
