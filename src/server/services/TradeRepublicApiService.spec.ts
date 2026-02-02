/* eslint-disable @typescript-eslint/unbound-method */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { EventEmitter } from 'events';

import { mockLogger } from '@test/loggerMock';
import type { CryptoManager } from './TradeRepublicApiService.crypto';
import type { CredentialsInput } from './TradeRepublicApiService.request';
import {
  AuthStatus,
  ConnectionStatus,
  type FetchFunction,
  HTTP_TIMEOUT_MS,
  type KeyPair,
  type SignedPayload,
} from './TradeRepublicApiService.types';
import type { WebSocketManager } from './TradeRepublicApiService.websocket';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  MESSAGE_CODE,
  TradeRepublicError,
} from './TradeRepublicApiService.types';

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

/**
 * Creates a mock login response.
 */
function createMockLoginResponse(): Partial<Response> {
  return {
    ok: true,
    json: () => Promise.resolve({ processId: 'test-process-id' }),
  };
}

/**
 * Helper to setup mock fetch for successful connect flow.
 * Returns the mockFetch configured for login + 2FA success.
 */
function setupConnectMocks(
  mockFetch: jest.MockedFunction<FetchFunction>,
): void {
  let callCount = 0;
  mockFetch.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // Login response
      return Promise.resolve(createMockLoginResponse() as Response);
    }
    // 2FA response
    return Promise.resolve(
      createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]) as Response,
    );
  });
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

  beforeEach(() => {
    mockCrypto = createMockCryptoManager();
    mockWs = createMockWebSocketManager();
    mockFetch = createMockFetch();
    service = new TradeRepublicApiService(
      testCredentials,
      mockCrypto,
      mockWs,
      mockFetch,
    );
  });

  describe('constructor', () => {
    it('should throw on invalid phone number format', () => {
      expect(
        () =>
          new TradeRepublicApiService(
            { phoneNumber: 'invalid', pin: '1234' },
            mockCrypto,
            mockWs,
            mockFetch,
          ),
      ).toThrow('Invalid credentials');
    });

    it('should throw on invalid PIN format', () => {
      expect(
        () =>
          new TradeRepublicApiService(
            { phoneNumber: '+491234567890', pin: '12' },
            mockCrypto,
            mockWs,
            mockFetch,
          ),
      ).toThrow('Invalid credentials');
    });

    it('should accept valid credentials', () => {
      expect(
        () =>
          new TradeRepublicApiService(
            testCredentials,
            mockCrypto,
            mockWs,
            mockFetch,
          ),
      ).not.toThrow();
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should authenticate with valid credentials and 2FA code', async () => {
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
    });

    it('should load existing key pair if stored', async () => {
      const existingKeyPair: KeyPair = {
        privateKeyPem:
          '-----BEGIN PRIVATE KEY-----\nexisting\n-----END PRIVATE KEY-----',
        publicKeyPem:
          '-----BEGIN PUBLIC KEY-----\nexisting\n-----END PUBLIC KEY-----',
      };
      mockCrypto.hasStoredKeyPair.mockResolvedValue(true);
      mockCrypto.loadKeyPair.mockResolvedValue(existingKeyPair);
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockCrypto.hasStoredKeyPair).toHaveBeenCalled();
      expect(mockCrypto.loadKeyPair).toHaveBeenCalled();
      expect(mockCrypto.generateKeyPair).not.toHaveBeenCalled();
    });

    it('should generate new key pair if none stored', async () => {
      mockCrypto.hasStoredKeyPair.mockResolvedValue(false);
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockCrypto.generateKeyPair).toHaveBeenCalled();
      expect(mockCrypto.saveKeyPair).toHaveBeenCalled();
    });

    it('should throw on invalid 2FA code format', async () => {
      await expect(service.connect('abc')).rejects.toThrow('Invalid 2FA code');
    });

    it('should throw on login failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      } as Response);

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Invalid credentials');
    });

    it('should use errorMessage from login error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ errorMessage: 'Error from errorMessage' }),
      } as Response);

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe('Error from errorMessage');
    });

    it('should use default error message if no login error details', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      } as Response);

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe('Login failed');
    });

    it('should use default error message if login error response is invalid', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve('not an object'),
      } as Response);

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe('Login failed');
    });

    it('should throw on 2FA verification failure', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Invalid 2FA code' }),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Invalid 2FA code');
    });

    it('should use errorMessage from 2FA error response', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ errorMessage: '2FA error message' }),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe('2FA error message');
    });

    it('should use default 2FA error message if no error details', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe('2FA verification failed');
    });

    it('should use default 2FA error message if error response is invalid', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve('invalid response'),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe('2FA verification failed');
    });

    it('should store cookies from 2FA response', async () => {
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalledWith(
        'session=test-session-cookie',
      );
    });

    it('should throw if no cookies received in 2FA response', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(createMock2FAResponse([]) as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe(
        'No cookies received from 2FA response',
      );
    });

    it('should handle response with no headers', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve({
          ok: true,
          headers: undefined,
          json: () => Promise.resolve({}),
        } as unknown as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await connectPromise;
      expect((result as Error).message).toBe(
        'No cookies received from 2FA response',
      );
    });

    it('should parse cookies using headers.get fallback', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        // Mock response without getSetCookie, only get method
        return Promise.resolve({
          ok: true,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === 'set-cookie'
                ? 'session=fallback-cookie; Domain=traderepublic.com'
                : null,
            // No getSetCookie function
          },
          json: () => Promise.resolve({}),
        } as Response);
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalledWith('session=fallback-cookie');
    });

    it('should parse multiple cookies from comma-separated set-cookie header', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve({
          ok: true,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === 'set-cookie'
                ? 'session=cookie1; Domain=traderepublic.com, refresh=cookie2; Domain=traderepublic.com'
                : null,
          },
          json: () => Promise.resolve({}),
        } as Response);
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalledWith(
        'session=cookie1; refresh=cookie2',
      );
    });

    it('should ignore malformed cookies (no equals sign)', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'malformed-cookie-without-equals',
            'session=valid-cookie; Domain=traderepublic.com',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalledWith('session=valid-cookie');
    });

    it('should ignore cookies with empty name', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            '=empty-name; Domain=traderepublic.com',
            'session=valid-cookie; Domain=traderepublic.com',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalledWith('session=valid-cookie');
    });

    it('should parse cookie with expires attribute', async () => {
      const expiresDate = 'Wed, 21 Oct 2025 07:28:00 GMT';
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            `session=test-cookie; Domain=traderepublic.com; Expires=${expiresDate}`,
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
    });

    it('should handle cookie with leading dot in domain', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-cookie; Domain=.traderepublic.com',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalledWith('session=test-cookie');
    });

    it('should connect WebSocket after successful auth', async () => {
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockWs.connect).toHaveBeenCalled();
    });

    it('should log initialization status', async () => {
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(logger.api.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing'),
      );
    });
  });

  describe('session refresh via validateSession', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should refresh session using GET with cookies when session is expired', async () => {
      // Force session to be expired by advancing time past expiration
      await jest.advanceTimersByTimeAsync(300000); // past 290s session duration

      const mockRefreshResponse = createMockRefreshResponse([
        'session=new-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mockRefreshResponse as Response);

      await service.validateSession();

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
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      const mockRefreshResponse = createMockRefreshResponse([
        'session=refreshed-session-cookie; Domain=traderepublic.com; Path=/',
      ]);
      mockFetch.mockResolvedValue(mockRefreshResponse as Response);

      await service.validateSession();
      await jest.advanceTimersByTimeAsync(1000); // wait for throttle

      // Force session to expire again
      await jest.advanceTimersByTimeAsync(300000);

      // Clear mock and refresh again to verify new cookie is used
      mockFetch.mockClear();
      mockFetch.mockResolvedValue(createMockRefreshResponse() as Response);

      await service.validateSession();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/session'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'session=refreshed-session-cookie',
          }),
        }),
      );
    });

    it('should throw if service not initialized when validating session', async () => {
      const freshService = new TradeRepublicApiService(
        testCredentials,
        mockCrypto,
        mockWs,
        mockFetch,
      );

      await expect(freshService.validateSession()).rejects.toThrow(
        'Service not initialized',
      );
    });

    it('should throw on refresh session failure', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Refresh failed' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.validateSession()).rejects.toThrow('Refresh failed');
    });

    it('should use errorMessage from refresh error response', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ errorMessage: 'Refresh error message' }),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.validateSession()).rejects.toThrow(
        'Refresh error message',
      );
    });

    it('should use default refresh error message if no error details', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.validateSession()).rejects.toThrow(
        'Session refresh failed',
      );
    });

    it('should use default refresh error message if error response is invalid', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve('invalid response'),
      };
      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.validateSession()).rejects.toThrow(
        'Session refresh failed',
      );
    });
  });

  describe('validateSession behavior', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
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

      await service.validateSession();

      // refreshSession should have been called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/web/session'),
        expect.anything(),
      );

      Date.now = originalNow;
    });

    it('should not refresh if session is still valid', async () => {
      mockFetch.mockClear();

      await service.validateSession();

      // refreshSession should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw if service not initialized', async () => {
      const freshService = new TradeRepublicApiService(
        testCredentials,
        mockCrypto,
        mockWs,
        mockFetch,
      );

      await expect(freshService.validateSession()).rejects.toThrow(
        'Service not initialized',
      );
    });

    describe('concurrent refresh mutex', () => {
      it('should only call refreshSession once for concurrent validateSession calls', async () => {
        // Force session to be expired by advancing time past expiration
        await jest.advanceTimersByTimeAsync(
          300000 - 30000 + 1000, // past 290s session duration minus 30s buffer
        );

        let refreshCallCount = 0;
        mockFetch.mockImplementation(() => {
          refreshCallCount++;
          return Promise.resolve(createMockRefreshResponse() as Response);
        });

        // Call validateSession concurrently (all before the fetch resolves)
        const promises = [
          service.validateSession(),
          service.validateSession(),
          service.validateSession(),
        ];

        // Advance timers to let the fetch resolve
        await jest.advanceTimersByTimeAsync(2000);

        // Wait for all promises
        const results = await Promise.all(promises);

        // All promises should resolve
        expect(results).toHaveLength(3);

        // refreshSession should only be called ONCE
        expect(refreshCallCount).toBe(1);
      });

      it('should propagate success to all concurrent callers', async () => {
        // Force session to be expired
        await jest.advanceTimersByTimeAsync(300000);

        mockFetch.mockResolvedValue(createMockRefreshResponse() as Response);

        const promises = [
          service.validateSession(),
          service.validateSession(),
          service.validateSession(),
        ];

        // Advance timers to let the fetch resolve
        await jest.advanceTimersByTimeAsync(2000);

        // All concurrent calls should resolve successfully
        await expect(Promise.all(promises)).resolves.not.toThrow();
      });

      it('should propagate error to all concurrent callers', async () => {
        // Force session to be expired
        await jest.advanceTimersByTimeAsync(300000);

        // Return 401 error which doesn't trigger retry (only 5xx and 429 retry)
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Session expired' }),
        } as Response);

        // Create promises that catch errors immediately to avoid unhandled rejection warnings
        const results: Array<{
          status: 'fulfilled' | 'rejected';
          reason?: Error;
        }> = [];
        const createSettledPromise = async (): Promise<void> => {
          try {
            await service.validateSession();
            results.push({ status: 'fulfilled' });
          } catch (error) {
            results.push({ status: 'rejected', reason: error as Error });
          }
        };

        // All concurrent calls
        const promises = [
          createSettledPromise(),
          createSettledPromise(),
          createSettledPromise(),
        ];

        // Advance timers to let the fetch resolve
        await jest.advanceTimersByTimeAsync(2000);

        await Promise.all(promises);

        // All should be rejected
        expect(results.every((r) => r.status === 'rejected')).toBe(true);

        // All should have the same error message
        expect(
          results.every((r) => r.reason?.message === 'Session expired'),
        ).toBe(true);
      });

      it('should clear promise after successful refresh allowing new refresh on next expiration', async () => {
        // Force session to be expired
        await jest.advanceTimersByTimeAsync(300000);

        let refreshCallCount = 0;
        mockFetch.mockImplementation(() => {
          refreshCallCount++;
          return Promise.resolve(createMockRefreshResponse() as Response);
        });

        // First batch of concurrent calls
        const batch1 = [service.validateSession(), service.validateSession()];
        await jest.advanceTimersByTimeAsync(2000);
        await Promise.all(batch1);
        expect(refreshCallCount).toBe(1);

        // Advance time past session expiration buffer to trigger another refresh
        await jest.advanceTimersByTimeAsync(300000);

        // Second batch should trigger a new refresh
        const batch2 = [service.validateSession(), service.validateSession()];
        await jest.advanceTimersByTimeAsync(2000);
        await Promise.all(batch2);
        expect(refreshCallCount).toBe(2);
      });

      it('should clear promise after failed refresh allowing retry', async () => {
        // Force session to be expired
        await jest.advanceTimersByTimeAsync(300000);

        let fetchCallCount = 0;
        // Use 401 to avoid retry logic (only 5xx and 429 retry)
        mockFetch.mockImplementation(() => {
          fetchCallCount++;
          if (fetchCallCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: () => Promise.resolve({ message: 'First call fails' }),
            } as Response);
          }
          return Promise.resolve(createMockRefreshResponse() as Response);
        });

        // First call fails - catch immediately to avoid unhandled rejection
        let firstErrorMessage = '';
        const promise1 = service.validateSession().catch((e: unknown) => {
          firstErrorMessage = (e as Error).message;
        });
        await jest.advanceTimersByTimeAsync(2000);
        await promise1;
        expect(firstErrorMessage).toBe('First call fails');

        // Second call should work (promise was cleared after failure)
        await jest.advanceTimersByTimeAsync(1000); // wait for rate limit
        const promise2 = service.validateSession();
        await jest.advanceTimersByTimeAsync(2000);
        await expect(promise2).resolves.toBeUndefined();

        // Should have made 2 fetch calls (first failed, second succeeded)
        expect(fetchCallCount).toBe(2);
      });
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should unsubscribe from a topic', () => {
      service.unsubscribe(42);

      expect(mockWs.unsubscribe).toHaveBeenCalledWith(42);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
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

  describe('subscribeAndWait', () => {
    const mockSchema = {
      safeParse: (data: unknown) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'value' in data &&
          typeof (data as { value: unknown }).value === 'number'
        ) {
          return { success: true as const, data: data as { value: number } };
        }
        return { success: false as const, error: new Error('Invalid schema') };
      },
    };

    beforeEach(async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should subscribe and resolve with parsed data on success', async () => {
      mockWs.subscribe.mockReturnValue(42);

      const promise = service.subscribeAndWait(
        'testTopic',
        { param: 'value' },
        mockSchema,
      );

      // Simulate successful response
      const message = { id: 42, code: MESSAGE_CODE.A, payload: { value: 123 } };
      mockWs.emit('message', message);

      const result = await promise;
      expect(result).toEqual({ value: 123 });
      expect(mockWs.subscribe).toHaveBeenCalledWith('testTopic', {
        param: 'value',
      });
    });

    it('should reject with error on API error response', async () => {
      mockWs.subscribe.mockReturnValue(43);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate error response
      const message = {
        id: 43,
        code: MESSAGE_CODE.E,
        payload: { message: 'Test error' },
      };
      mockWs.emit('message', message);

      await expect(promise).rejects.toThrow(TradeRepublicError);
      await expect(promise).rejects.toThrow('Test error');
    });

    it('should reject with default error message if error payload has no message', async () => {
      mockWs.subscribe.mockReturnValue(44);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate error response without message
      const message = { id: 44, code: MESSAGE_CODE.E, payload: {} };
      mockWs.emit('message', message);

      await expect(promise).rejects.toThrow('API error');
    });

    it('should reject with error on schema validation failure', async () => {
      mockWs.subscribe.mockReturnValue(45);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate response with invalid data
      const message = {
        id: 45,
        code: MESSAGE_CODE.A,
        payload: { invalid: 'data' },
      };
      mockWs.emit('message', message);

      await expect(promise).rejects.toThrow(
        'Invalid testTopic response format',
      );
    });

    it('should reject on timeout', async () => {
      mockWs.subscribe.mockReturnValue(46);

      const promise = service
        .subscribeAndWait('testTopic', {}, mockSchema, 1000) // 1 second timeout
        .catch((e: unknown) => e as Error);

      // Advance time past timeout
      await jest.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toBeInstanceOf(TradeRepublicError);
      expect((result as Error).message).toBe('testTopic request timed out');
    });

    it('should reject on WebSocket error', async () => {
      mockWs.subscribe.mockReturnValue(47);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate error event
      const error = new Error('WebSocket connection lost');
      mockWs.emit('error', error);

      await expect(promise).rejects.toThrow('WebSocket connection lost');
    });

    it('should reject on WebSocket error message for matching subscription', async () => {
      mockWs.subscribe.mockReturnValue(48);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate error message
      const errorMessage = {
        id: 48,
        code: MESSAGE_CODE.E,
        payload: { message: 'Subscription error' },
      };
      mockWs.emit('error', errorMessage);

      await expect(promise).rejects.toThrow('Subscription error');
    });

    it('should ignore messages for other subscriptions', async () => {
      mockWs.subscribe.mockReturnValue(49);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate message for different subscription
      const otherMessage = {
        id: 99,
        code: MESSAGE_CODE.A,
        payload: { value: 999 },
      };
      mockWs.emit('message', otherMessage);

      // Our subscription should still be pending
      // Send the correct message
      const ourMessage = {
        id: 49,
        code: MESSAGE_CODE.A,
        payload: { value: 42 },
      };
      mockWs.emit('message', ourMessage);

      const result = await promise;
      expect(result).toEqual({ value: 42 });
    });

    it('should reject if subscribe throws', async () => {
      mockWs.subscribe.mockImplementation(() => {
        throw new Error('Subscribe failed');
      });

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      await expect(promise).rejects.toThrow('Subscribe failed');
    });

    it('should unsubscribe on cleanup', async () => {
      mockWs.subscribe.mockReturnValue(50);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Simulate successful response
      const message = { id: 50, code: MESSAGE_CODE.A, payload: { value: 123 } };
      mockWs.emit('message', message);

      await promise;

      expect(mockWs.unsubscribe).toHaveBeenCalledWith(50);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clean up', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      service.disconnect();

      expect(mockWs.disconnect).toHaveBeenCalled();
      expect(service.getAuthStatus()).toBe(AuthStatus.UNAUTHENTICATED);
      jest.useRealTimers();
    });
  });

  describe('error states', () => {
    it('should emit error events from WebSocket', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      const errorHandler = jest.fn();
      service.onError(errorHandler);

      const error = new Error('WebSocket error');
      mockWs.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
      jest.useRealTimers();
    });

    it('should emit message events from WebSocket', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      const messageHandler = jest.fn();
      service.onMessage(messageHandler);

      const message = { id: 1, code: 'A', payload: { price: 100 } };
      mockWs.emit('message', message);

      expect(messageHandler).toHaveBeenCalledWith(message);
      jest.useRealTimers();
    });
  });

  describe('getAuthStatus', () => {
    it('should return UNAUTHENTICATED initially', () => {
      expect(service.getAuthStatus()).toBe(AuthStatus.UNAUTHENTICATED);
    });
  });

  describe('offMessage', () => {
    it('should remove a registered message handler', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      const handler = jest.fn();
      service.onMessage(handler);
      service.offMessage(handler);

      const message = { id: 1, code: 'A', payload: { test: true } };
      mockWs.emit('message', message);

      expect(handler).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should do nothing if handler not found', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      const handler = jest.fn();
      expect(() => {
        service.offMessage(handler);
      }).not.toThrow();
      jest.useRealTimers();
    });
  });

  describe('offError', () => {
    it('should remove a registered error handler', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      const handler = jest.fn();
      service.onError(handler);
      service.offError(handler);

      const error = new Error('Test error');
      mockWs.emit('error', error);

      expect(handler).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should do nothing if handler not found', async () => {
      jest.useFakeTimers();
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      const handler = jest.fn();
      expect(() => {
        service.offError(handler);
      }).not.toThrow();
      jest.useRealTimers();
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Create service with default throttle interval (1000ms) for rate limiting tests
      service = new TradeRepublicApiService(
        testCredentials,
        mockCrypto,
        mockWs,
        mockFetch,
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle rapid HTTP requests to max 1 per second', async () => {
      // Track when each fetch call was made
      const fetchCallTimes: number[] = [];
      let callIndex = 0;

      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        callIndex++;

        // First call: login response
        if (callIndex === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }

        // Second call: 2FA response with cookies
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-session-cookie; Domain=traderepublic.com; Path=/',
          ]) as Response,
        );
      });

      // A single connect call makes 2 HTTP requests: login and 2FA
      // Both requests go through the same service's throttle
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      // Both calls should have been made (login and 2FA)
      expect(fetchCallTimes).toHaveLength(2);

      // Second request should be delayed by at least 1000ms (throttle interval)
      expect(fetchCallTimes[1] - fetchCallTimes[0]).toBeGreaterThanOrEqual(
        1000,
      );
    });

    it('should throttle across different HTTP methods (login, verify2FA, refreshSession)', async () => {
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

      // Start connect (login + 2FA)
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      // Force session to be expired so validateSession triggers refreshSession
      await jest.advanceTimersByTimeAsync(300000); // past 290s session duration

      // Start refresh session via validateSession
      const refreshPromise = service.validateSession();
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
      const fetchCallTimes: number[] = [];
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        callCount++;

        // First call: login response
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }

        // Second call: 2FA response with cookies
        if (callCount === 2) {
          return Promise.resolve(
            createMock2FAResponse([
              'session=test-session-cookie; Domain=traderepublic.com; Path=/',
            ]) as Response,
          );
        }

        // Third call: refresh session response
        return Promise.resolve(createMockRefreshResponse() as Response);
      });

      // Connect - makes 2 calls (login + 2FA)
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      const secondCallTime = fetchCallTimes[1];

      // Wait for significantly more than 1 second before next request
      await jest.advanceTimersByTimeAsync(300000); // Force session expiry

      // Trigger a refresh via validateSession - should not need full 1s delay
      // since we waited long enough
      const refreshPromise = service.validateSession();
      await jest.advanceTimersByTimeAsync(100);
      await refreshPromise;

      expect(fetchCallTimes).toHaveLength(3);

      // Third request should have been made at least 300000ms after second request
      // This proves it didn't need to wait for throttle (it was already past the interval)
      expect(fetchCallTimes[2] - secondCallTime).toBeGreaterThanOrEqual(300000);
    });
  });

  describe('exponential backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Create service with default throttle interval for backoff tests
      service = new TradeRepublicApiService(
        testCredentials,
        mockCrypto,
        mockWs,
        mockFetch,
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry on 500 server error up to 3 times then fail', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Internal server error' }),
        } as Response);
      });

      // Start the connect and advance timers concurrently
      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);

      // Advance through all retry attempts with backoff delays
      // 1st attempt: immediate
      // 2nd attempt: after 1s delay
      // 3rd attempt: after 2s delay
      // 4th attempt: after 4s delay (final failure)
      await jest.advanceTimersByTimeAsync(10000);

      const result = await connectPromise;
      expect(result).toBeInstanceOf(Error);
      expect(callCount).toBe(4); // Initial + 3 retries
    });

    it('should retry on 429 rate limit error', async () => {
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
        if (callCount === 2) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-session-cookie; Domain=traderepublic.com; Path=/',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(10000);

      await connectPromise;
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
      expect(callCount).toBeGreaterThanOrEqual(2); // At least initial failed + retry success
    });

    it('should NOT retry on 400 client error', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: 'Bad request' }),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await connectPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Bad request');
      expect(callCount).toBe(1); // No retries
    });

    it('should NOT retry on 401 unauthorized error', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Invalid credentials' }),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);
      await jest.advanceTimersByTimeAsync(1000);

      const result = await connectPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Invalid credentials');
      expect(callCount).toBe(1); // No retries
    });

    it('should retry on network error', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('ECONNRESET');
          (error as NodeJS.ErrnoException).code = 'ECONNRESET';
          return Promise.reject(error);
        }
        if (callCount === 2) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-session-cookie; Domain=traderepublic.com; Path=/',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(10000);

      await connectPromise;
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
      expect(callCount).toBeGreaterThanOrEqual(2); // Initial failed, then success
    });

    it('should succeed after transient 500 failure', async () => {
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
        if (callCount === 2) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-session-cookie; Domain=traderepublic.com; Path=/',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(10000);

      await connectPromise;
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should log retry attempts', async () => {
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
        if (callCount === 3) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-session-cookie; Domain=traderepublic.com; Path=/',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(15000);

      await connectPromise;

      expect(logger.api.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: expect.any(Number),
          retriesLeft: expect.any(Number),
        }),
        expect.stringContaining('retrying'),
      );
    });

    it('should retry 2FA verification on 503 service unavailable', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        // First call: login success
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        // Second call: 2FA 503 error
        if (callCount === 2) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ message: 'Service unavailable' }),
          } as Response);
        }
        // Third call: 2FA success
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-cookie; Domain=traderepublic.com',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(15000);

      await connectPromise;
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should retry refreshSession on 502 bad gateway', async () => {
      // First setup authenticated state
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      // Force session to be expired so validateSession triggers refreshSession
      await jest.advanceTimersByTimeAsync(300000); // past 290s session duration

      // Now test refresh with retry
      let refreshCallCount = 0;
      mockFetch.mockImplementation(() => {
        refreshCallCount++;
        if (refreshCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 502,
            json: () => Promise.resolve({ message: 'Bad gateway' }),
          } as Response);
        }
        return Promise.resolve(createMockRefreshResponse() as Response);
      });

      const refreshPromise = service.validateSession();
      await jest.advanceTimersByTimeAsync(10000);

      await refreshPromise;
      expect(refreshCallCount).toBe(2);
    });

    it('should include AbortSignal.timeout in fetch requests', async () => {
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      // Verify the fetch was called with a signal option
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should retry when request times out', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        // Simulate timeout on first call by throwing an abort error
        if (callCount === 1) {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        }
        if (callCount === 2) {
          return Promise.resolve(createMockLoginResponse() as Response);
        }
        return Promise.resolve(
          createMock2FAResponse([
            'session=test-session-cookie; Domain=traderepublic.com; Path=/',
          ]) as Response,
        );
      });

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(20000);

      await connectPromise;
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
      expect(callCount).toBeGreaterThanOrEqual(2); // First timeout, second success
    });

    it('should fail after all retry attempts timeout', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);

      await jest.advanceTimersByTimeAsync(30000);

      const result = await connectPromise;
      expect(result).toBeInstanceOf(Error);
      expect(callCount).toBe(4); // Initial + 3 retries
    });

    it('should use HTTP_TIMEOUT_MS constant value of 10000ms', () => {
      expect(HTTP_TIMEOUT_MS).toBe(10000);
    });

    it('should respect exponential backoff timing (1s, 2s, 4s delays)', async () => {
      const fetchCallTimes: number[] = [];
      mockFetch.mockImplementation(() => {
        fetchCallTimes.push(Date.now());
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        } as Response);
      });

      const connectPromise = service
        .connect('5678')
        .catch((e: unknown) => e as Error);

      // Wait for all retries to complete
      await jest.advanceTimersByTimeAsync(20000);

      const result = await connectPromise;
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
