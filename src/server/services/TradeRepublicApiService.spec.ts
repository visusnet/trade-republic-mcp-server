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
import { mockFetchResponse, type MockResponse } from '@test/serviceMocks';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));
jest.mock('./TradeRepublicApiService.crypto');
jest.mock('./TradeRepublicApiService.websocket');

import { CryptoManager } from './TradeRepublicApiService.crypto';
import {
  AuthStatus,
  ConnectionStatus,
  HTTP_TIMEOUT_MS,
  MESSAGE_CODE,
  TradeRepublicError,
  TwoFactorCodeRequiredException,
  type KeyPair,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import { WebSocketManager } from './TradeRepublicApiService.websocket';
import { TradeRepublicCredentials } from './TradeRepublicCredentials';
import { TradeRepublicApiService } from './TradeRepublicApiService';

// Store original fetch
const originalFetch = global.fetch;

/**
 * Helper to throw a non-Error string for testing edge cases.
 * @internal Used to test code paths that handle non-Error throws from external code.
 */
function throwNonErrorString(message: string): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw message;
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
function createMockLoginResponse(): MockResponse<{ processId: string }> {
  return mockFetchResponse({ processId: 'test-process-id' });
}

/**
 * Helper to setup mock fetch for successful connect flow.
 * Returns the mockFetch configured for login + 2FA success.
 */
function setupConnectMocks(mockFetch: jest.MockedFunction<typeof fetch>): void {
  let callCount = 0;
  mockFetch.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // Login response
      return Promise.resolve(createMockLoginResponse());
    }
    // 2FA response
    return Promise.resolve(
      createMock2FAResponse([
        'session=test-session-cookie; Domain=traderepublic.com; Path=/',
      ]) as Response,
    );
  });
}

// Standalone mock functions to avoid unbound-method lint errors
// CryptoManager mocks
const generateKeyPairMock = jest.fn<() => Promise<KeyPair>>();
const saveKeyPairMock = jest.fn<(keyPair: KeyPair) => Promise<void>>();
const loadKeyPairMock = jest.fn<() => Promise<KeyPair | null>>();
const hasStoredKeyPairMock = jest.fn<() => Promise<boolean>>();
const signMock = jest.fn<(message: string, privateKey: string) => string>();
const createSignedPayloadMock = jest.fn();
const getPublicKeyBase64Mock = jest.fn<(publicKey: string) => string>();

// WebSocketManager mocks
const wsConnectMock = jest.fn<(token: string) => Promise<void>>();
const wsDisconnectMock = jest.fn<() => void>();
const wsSubscribeMock = jest.fn<(topic: string, payload: unknown) => number>();
const wsUnsubscribeMock = jest.fn<(subscriptionId: number) => void>();
const wsIsConnectedMock = jest.fn<() => boolean>();
const wsGetConnectionStatusMock = jest.fn<() => ConnectionStatus>();

describe('TradeRepublicApiService', () => {
  let mockCryptoManagerInstance: jest.Mocked<CryptoManager>;
  let mockWebSocketManagerInstance: jest.Mocked<WebSocketManager> &
    EventEmitter;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let service: TradeRepublicApiService;

  const testCredentials = new TradeRepublicCredentials('+491234567890', '1234');

  const mockKeyPair: KeyPair = {
    privateKeyPem:
      '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
  };

  beforeEach(() => {
    // Reset standalone mocks
    generateKeyPairMock.mockReset().mockResolvedValue(mockKeyPair);
    saveKeyPairMock.mockReset().mockResolvedValue(undefined);
    loadKeyPairMock.mockReset().mockResolvedValue(null);
    hasStoredKeyPairMock.mockReset().mockResolvedValue(false);
    signMock.mockReset().mockReturnValue('mock-signature');
    createSignedPayloadMock.mockReset().mockReturnValue({
      timestamp: new Date().toISOString(),
      data: {},
      signature: 'mock-signature',
    });
    getPublicKeyBase64Mock.mockReset().mockReturnValue('bW9jay1wdWJsaWMta2V5');

    wsConnectMock.mockReset().mockResolvedValue(undefined);
    wsDisconnectMock.mockReset();
    wsSubscribeMock.mockReset().mockReturnValue(1);
    wsUnsubscribeMock.mockReset();
    wsIsConnectedMock.mockReset().mockReturnValue(true);
    wsGetConnectionStatusMock
      .mockReset()
      .mockReturnValue(ConnectionStatus.CONNECTED);

    // Setup mock CryptoManager
    const MockedCryptoManager = jest.mocked(CryptoManager);
    MockedCryptoManager.mockClear();

    mockCryptoManagerInstance = {
      generateKeyPair: generateKeyPairMock,
      saveKeyPair: saveKeyPairMock,
      loadKeyPair: loadKeyPairMock,
      hasStoredKeyPair: hasStoredKeyPairMock,
      sign: signMock,
      createSignedPayload: createSignedPayloadMock,
      getPublicKeyBase64: getPublicKeyBase64Mock,
    } as unknown as jest.Mocked<CryptoManager>;

    MockedCryptoManager.mockImplementation(() => mockCryptoManagerInstance);

    // Setup mock WebSocketManager with EventEmitter functionality
    const MockedWebSocketManager = jest.mocked(WebSocketManager);
    MockedWebSocketManager.mockClear();

    const emitter = new EventEmitter();
    mockWebSocketManagerInstance = {
      connect: wsConnectMock,
      disconnect: wsDisconnectMock,
      getStatus: wsGetConnectionStatusMock.mockReturnValue(
        ConnectionStatus.DISCONNECTED,
      ),
      subscribe: wsSubscribeMock,
      unsubscribe: wsUnsubscribeMock,
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        emitter.on(event, listener);
        return mockWebSocketManagerInstance;
      }),
      removeAllListeners: jest.fn(() => {
        emitter.removeAllListeners();
        return mockWebSocketManagerInstance;
      }),
      emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
    } as unknown as jest.Mocked<WebSocketManager> & EventEmitter;

    MockedWebSocketManager.mockImplementation(
      () => mockWebSocketManagerInstance,
    );

    // Setup mock fetch
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;

    service = new TradeRepublicApiService(testCredentials);
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
      mockCryptoManagerInstance.hasStoredKeyPair.mockResolvedValue(true);
      mockCryptoManagerInstance.loadKeyPair.mockResolvedValue(existingKeyPair);
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(hasStoredKeyPairMock).toHaveBeenCalled();
      expect(loadKeyPairMock).toHaveBeenCalled();
      expect(generateKeyPairMock).not.toHaveBeenCalled();
    });

    it('should generate new key pair if none stored', async () => {
      mockCryptoManagerInstance.hasStoredKeyPair.mockResolvedValue(false);
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(generateKeyPairMock).toHaveBeenCalled();
      expect(saveKeyPairMock).toHaveBeenCalled();
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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

      expect(wsConnectMock).toHaveBeenCalledWith('session=test-session-cookie');
    });

    it('should throw if no cookies received in 2FA response', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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

      expect(wsConnectMock).toHaveBeenCalledWith('session=fallback-cookie');
    });

    it('should parse multiple cookies from comma-separated set-cookie header', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse());
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

      expect(wsConnectMock).toHaveBeenCalledWith(
        'session=cookie1; refresh=cookie2',
      );
    });

    it('should ignore malformed cookies (no equals sign)', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse());
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

      expect(wsConnectMock).toHaveBeenCalledWith('session=valid-cookie');
    });

    it('should ignore cookies with empty name', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse());
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

      expect(wsConnectMock).toHaveBeenCalledWith('session=valid-cookie');
    });

    it('should parse cookie with expires attribute', async () => {
      const expiresDate = 'Wed, 21 Oct 2025 07:28:00 GMT';
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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

      expect(wsConnectMock).toHaveBeenCalledWith('session=test-cookie');
    });

    it('should connect WebSocket after successful auth', async () => {
      setupConnectMocks(mockFetch);

      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(wsConnectMock).toHaveBeenCalled();
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
      const freshService = new TradeRepublicApiService(testCredentials);

      await expect(freshService.validateSession()).rejects.toThrow(
        'Service not initialized',
      );
    });

    it('should throw if initialized but not authenticated when validating session', async () => {
      // Create fresh service and trigger login flow (which initializes but doesn't authenticate)
      const freshService = new TradeRepublicApiService(testCredentials);
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());

      // subscribeAndWait triggers initialization and login, then throws TwoFactorCodeRequiredException
      const subscribePromise = freshService
        .subscribeAndWait(
          'testTopic',
          {},
          { safeParse: () => ({ success: true, data: {} }) },
        )
        .catch(() => {});
      await jest.advanceTimersByTimeAsync(3000);
      await subscribePromise;

      // Service is now initialized (in AWAITING_2FA state) but not authenticated
      expect(freshService.getAuthStatus()).toBe(AuthStatus.AWAITING_2FA);

      // validateSession should throw because not authenticated
      await expect(freshService.validateSession()).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('should throw on refresh session failure', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      mockFetch.mockResolvedValue(
        mockFetchResponse(
          { message: 'Refresh failed' },
          { ok: false, status: 401 },
        ),
      );

      await expect(service.validateSession()).rejects.toThrow('Refresh failed');
    });

    it('should use errorMessage from refresh error response', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      mockFetch.mockResolvedValue(
        mockFetchResponse(
          { errorMessage: 'Refresh error message' },
          { ok: false, status: 401 },
        ),
      );

      await expect(service.validateSession()).rejects.toThrow(
        'Refresh error message',
      );
    });

    it('should use default refresh error message if no error details', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      mockFetch.mockResolvedValue(
        mockFetchResponse({}, { ok: false, status: 401 }),
      );

      await expect(service.validateSession()).rejects.toThrow(
        'Session refresh failed',
      );
    });

    it('should use default refresh error message if error response is invalid', async () => {
      // Force session to be expired
      await jest.advanceTimersByTimeAsync(300000);

      mockFetch.mockResolvedValue(
        mockFetchResponse('invalid response', { ok: false, status: 401 }),
      );

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
      const freshService = new TradeRepublicApiService(testCredentials);

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

      expect(wsUnsubscribeMock).toHaveBeenCalledWith(42);
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
      mockWebSocketManagerInstance.subscribe.mockReturnValue(42);

      const subId = service.subscribe({
        topic: 'ticker',
        payload: { isin: 'DE0007164600' },
      });

      expect(subId).toBe(42);
      expect(wsSubscribeMock).toHaveBeenCalledWith('ticker', {
        isin: 'DE0007164600',
      });
    });

    it('should subscribe without payload', () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(43);

      const subId = service.subscribe({ topic: 'portfolio' });

      expect(subId).toBe(43);
      expect(wsSubscribeMock).toHaveBeenCalledWith('portfolio', undefined);
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
      mockWebSocketManagerInstance.subscribe.mockReturnValue(42);

      const promise = service.subscribeAndWait(
        'testTopic',
        { param: 'value' },
        mockSchema,
      );

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate successful response
      const message = { id: 42, code: MESSAGE_CODE.A, payload: { value: 123 } };
      mockWebSocketManagerInstance.emit('message', message);

      const result = await promise;
      expect(result).toEqual({ value: 123 });
      expect(wsSubscribeMock).toHaveBeenCalledWith('testTopic', {
        param: 'value',
      });
    });

    it('should reject with error on API error response', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(43);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate error response
      const message = {
        id: 43,
        code: MESSAGE_CODE.E,
        payload: { message: 'Test error' },
      };
      mockWebSocketManagerInstance.emit('message', message);

      await expect(promise).rejects.toThrow(TradeRepublicError);
      await expect(promise).rejects.toThrow('Test error');
    });

    it('should reject with default error message if error payload has no message', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(44);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate error response without message
      const message = { id: 44, code: MESSAGE_CODE.E, payload: {} };
      mockWebSocketManagerInstance.emit('message', message);

      await expect(promise).rejects.toThrow('API error');
    });

    it('should reject with error on schema validation failure', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(45);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate response with invalid data
      const message = {
        id: 45,
        code: MESSAGE_CODE.A,
        payload: { invalid: 'data' },
      };
      mockWebSocketManagerInstance.emit('message', message);

      await expect(promise).rejects.toThrow(
        'Invalid testTopic response format',
      );
    });

    it('should reject on timeout', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(46);

      const promise = service
        .subscribeAndWait('testTopic', {}, mockSchema)
        .catch((e: unknown) => e as Error);

      // Advance time past timeout (30 seconds default)
      await jest.advanceTimersByTimeAsync(31_000);

      const result = await promise;
      expect(result).toBeInstanceOf(TradeRepublicError);
      expect((result as Error).message).toBe('testTopic request timed out');
    });

    it('should reject on WebSocket error', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(47);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate error event
      const error = new Error('WebSocket connection lost');
      mockWebSocketManagerInstance.emit('error', error);

      await expect(promise).rejects.toThrow('WebSocket connection lost');
    });

    it('should reject on WebSocket error message for matching subscription', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(48);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate error message
      const errorMessage = {
        id: 48,
        code: MESSAGE_CODE.E,
        payload: { message: 'Subscription error' },
      };
      mockWebSocketManagerInstance.emit('error', errorMessage);

      await expect(promise).rejects.toThrow('Subscription error');
    });

    it('should ignore messages for other subscriptions', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(49);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate message for different subscription
      const otherMessage = {
        id: 99,
        code: MESSAGE_CODE.A,
        payload: { value: 999 },
      };
      mockWebSocketManagerInstance.emit('message', otherMessage);

      // Our subscription should still be pending
      // Send the correct message
      const ourMessage = {
        id: 49,
        code: MESSAGE_CODE.A,
        payload: { value: 42 },
      };
      mockWebSocketManagerInstance.emit('message', ourMessage);

      const result = await promise;
      expect(result).toEqual({ value: 42 });
    });

    it('should reject if subscribe throws', async () => {
      mockWebSocketManagerInstance.subscribe.mockImplementation(() => {
        throw new Error('Subscribe failed');
      });

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      await expect(promise).rejects.toThrow('Subscribe failed');
    });

    it('should unsubscribe on cleanup', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(50);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate successful response
      const message = { id: 50, code: MESSAGE_CODE.A, payload: { value: 123 } };
      mockWebSocketManagerInstance.emit('message', message);

      await promise;

      expect(wsUnsubscribeMock).toHaveBeenCalledWith(50);
    });

    it('should ignore errors after already resolved (race condition)', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(51);

      // Capture the error handler before it gets removed by cleanup
      // Use a wrapper object to avoid TypeScript narrowing issues with closures
      type ErrorHandler = (error: Error | WebSocketMessage) => void;
      const captured: { handler: ErrorHandler | null } = { handler: null };
      const originalOnError = service.onError.bind(service);
      jest.spyOn(service, 'onError').mockImplementation((handler) => {
        captured.handler = handler as ErrorHandler;
        originalOnError(handler);
      });

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // First, resolve with success
      const successMessage = {
        id: 51,
        code: MESSAGE_CODE.A,
        payload: { value: 42 },
      };
      mockWebSocketManagerInstance.emit('message', successMessage);

      // Manually call the captured error handler after resolution (simulating race condition)
      // This bypasses the cleanup that would have removed the handler
      expect(captured.handler).not.toBeNull();
      const lateError = new Error('Late error after resolution');
      // Handler is guaranteed non-null by expect above
      if (captured.handler !== null) {
        captured.handler(lateError);
      }

      // The promise should resolve with the success value, not reject
      const result = await promise;
      expect(result).toEqual({ value: 42 });
    });

    it('should use String(payload) as fallback when error message has no message field', async () => {
      mockWebSocketManagerInstance.subscribe.mockReturnValue(52);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete before emitting message
      await jest.advanceTimersByTimeAsync(0);

      // Simulate error with payload that has no message field
      const errorMessage = {
        id: 52,
        code: MESSAGE_CODE.E,
        payload: 'raw-error-string', // No message field, just a string payload
      };
      mockWebSocketManagerInstance.emit('error', errorMessage);

      await expect(promise).rejects.toThrow('raw-error-string');
    });

    it('should reject with non-Error string when subscribe throws non-Error', async () => {
      mockWebSocketManagerInstance.subscribe.mockImplementation(() => {
        throwNonErrorString('string-error-not-Error-instance');
      });

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      await expect(promise).rejects.toThrow('string-error-not-Error-instance');
    });
  });

  describe('subscribeAndWait lazy auth', () => {
    const mockSchema = {
      safeParse: (data: unknown) => ({
        success: true as const,
        data: data as { value: number },
      }),
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throw TwoFactorCodeRequiredException when not authenticated', async () => {
      // Setup mocks for login request (no 2FA)
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());

      // Catch the error inline to handle the promise rejection properly
      let caughtError: unknown = null;
      const promise = service
        .subscribeAndWait('testTopic', {}, mockSchema)
        .catch((e: unknown) => {
          caughtError = e;
        });

      // Advance timers to allow async operations to complete
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(caughtError).toBeInstanceOf(TwoFactorCodeRequiredException);
    });

    it('should include masked phone number in TwoFactorCodeRequiredException', async () => {
      // Setup mocks for login request
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());

      let caughtError: unknown = null;
      const promise = service
        .subscribeAndWait('testTopic', {}, mockSchema)
        .catch((e: unknown) => {
          caughtError = e;
        });

      // Advance timers to allow async operations to complete
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(caughtError).toBeInstanceOf(TwoFactorCodeRequiredException);
      expect((caughtError as TwoFactorCodeRequiredException).message).toContain(
        '+49123***90',
      );
    });

    it('should include error message in TwoFactorCodeRequiredException', async () => {
      // Setup mocks for login request
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());

      let caughtError: unknown = null;
      const promise = service
        .subscribeAndWait('testTopic', {}, mockSchema)
        .catch((e: unknown) => {
          caughtError = e;
        });

      // Advance timers to allow async operations to complete
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(caughtError).toBeInstanceOf(TwoFactorCodeRequiredException);
      expect((caughtError as TwoFactorCodeRequiredException).message).toContain(
        '2FA code required',
      );
    });

    it('should throw TwoFactorCodeRequiredException when awaiting 2FA', async () => {
      // Setup mocks: login succeeds but no 2FA yet
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());

      // First call initiates login and throws TwoFactorCodeRequiredException
      let error1: unknown = null;
      const promise1 = service
        .subscribeAndWait('testTopic', {}, mockSchema)
        .catch((e: unknown) => {
          error1 = e;
        });
      await jest.advanceTimersByTimeAsync(3000);
      await promise1;

      expect(error1).toBeInstanceOf(TwoFactorCodeRequiredException);

      // Service is now in AWAITING_2FA state
      expect(service.getAuthStatus()).toBe(AuthStatus.AWAITING_2FA);

      // Second call should also throw TwoFactorCodeRequiredException
      let error2: unknown = null;
      const promise2 = service
        .subscribeAndWait('testTopic', {}, mockSchema)
        .catch((e: unknown) => {
          error2 = e;
        });
      await jest.advanceTimersByTimeAsync(3000);
      await promise2;

      expect(error2).toBeInstanceOf(TwoFactorCodeRequiredException);
    });

    it('should proceed normally when already authenticated', async () => {
      // First, authenticate the service
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      // Now subscribeAndWait should work normally
      mockWebSocketManagerInstance.subscribe.mockReturnValue(99);

      const promise = service.subscribeAndWait('testTopic', {}, mockSchema);

      // Allow async auth check to complete
      await jest.advanceTimersByTimeAsync(0);

      // Simulate successful response
      const message = {
        id: 99,
        code: MESSAGE_CODE.A,
        payload: { value: 42 },
      };
      mockWebSocketManagerInstance.emit('message', message);

      const result = await promise;
      expect(result).toEqual({ value: 42 });
    });
  });

  describe('enterTwoFactorCode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return success message when 2FA verification succeeds', async () => {
      // First, trigger login to get to AWAITING_2FA state
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());
      const subscribePromise = service
        .subscribeAndWait(
          'testTopic',
          {},
          { safeParse: () => ({ success: true, data: {} }) },
        )
        .catch(() => {});
      await jest.advanceTimersByTimeAsync(3000);
      await subscribePromise;

      expect(service.getAuthStatus()).toBe(AuthStatus.AWAITING_2FA);

      // Now enter 2FA code - should succeed
      mockFetch.mockResolvedValueOnce(
        createMock2FAResponse([
          'session=test-session-cookie; Domain=traderepublic.com; Path=/',
        ]) as Response,
      );

      const resultPromise = service.enterTwoFactorCode({ code: '1234' });
      await jest.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      expect(result.message).toBe('Authentication successful');
      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);
    });

    it('should return error message when 2FA verification fails', async () => {
      // First, trigger login to get to AWAITING_2FA state
      mockFetch.mockResolvedValueOnce(createMockLoginResponse());
      const subscribePromise = service
        .subscribeAndWait(
          'testTopic',
          {},
          { safeParse: () => ({ success: true, data: {} }) },
        )
        .catch(() => {});
      await jest.advanceTimersByTimeAsync(3000);
      await subscribePromise;

      expect(service.getAuthStatus()).toBe(AuthStatus.AWAITING_2FA);

      // Now enter wrong 2FA code - should fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid 2FA code' }),
      } as Response);

      const resultPromise = service.enterTwoFactorCode({ code: '0000' });
      await jest.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      expect(result.message).toBe('Invalid 2FA code');
      expect(service.getAuthStatus()).toBe(AuthStatus.AWAITING_2FA);
    });

    it('should return error message when not in AWAITING_2FA state', async () => {
      // Service is UNAUTHENTICATED, not AWAITING_2FA
      const result = await service.enterTwoFactorCode({ code: '1234' });

      expect(result.message).toBe(
        'Not awaiting 2FA verification. Initiate login first.',
      );
    });

    it('should return error message when code is empty', async () => {
      const result = await service.enterTwoFactorCode({ code: '' });

      expect(result.message).toBe('Code is required');
    });

    it('should return error message when already authenticated', async () => {
      // Authenticate first
      setupConnectMocks(mockFetch);
      const connectPromise = service.connect('5678');
      await jest.advanceTimersByTimeAsync(3000);
      await connectPromise;

      expect(service.getAuthStatus()).toBe(AuthStatus.AUTHENTICATED);

      // Try to enter 2FA code when already authenticated
      const result = await service.enterTwoFactorCode({ code: '1234' });

      expect(result.message).toBe('Already authenticated');
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

      expect(wsDisconnectMock).toHaveBeenCalled();
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
      mockWebSocketManagerInstance.emit('error', error);

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
      mockWebSocketManagerInstance.emit('message', message);

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
      mockWebSocketManagerInstance.emit('message', message);

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
      mockWebSocketManagerInstance.emit('error', error);

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
      service = new TradeRepublicApiService(testCredentials);
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
      service = new TradeRepublicApiService(testCredentials);
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
          return Promise.resolve(createMockLoginResponse());
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
