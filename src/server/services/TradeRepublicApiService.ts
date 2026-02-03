/**
 * Trade Republic API Service
 *
 * Main service for interacting with the Trade Republic API.
 * Handles authentication, session management, and WebSocket communication.
 */

import os from 'node:os';
import path from 'node:path';

import pRetry from 'p-retry';
import pThrottle from 'p-throttle';

import { logger } from '../../logger';
import { CryptoManager } from './TradeRepublicApiService.crypto';
import {
  EnterTwoFactorCodeRequestSchema,
  SubscribeRequestSchema,
  TwoFactorCodeSchema,
  type EnterTwoFactorCodeRequest,
  type SubscribeRequestInput,
} from './TradeRepublicApiService.request';
import {
  ErrorResponseSchema,
  LoginResponseSchema,
  type EnterTwoFactorCodeResponse,
} from './TradeRepublicApiService.response';
import {
  AuthenticationError,
  AuthStatus,
  DEFAULT_CONFIG_DIR,
  DEFAULT_SESSION_DURATION_MS,
  HTTP_TIMEOUT_MS,
  MESSAGE_CODE,
  TR_API_URL,
  TradeRepublicError,
  TwoFactorCodeRequiredException,
  type KeyPair,
  type StoredCookie,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import { WebSocketManager } from './TradeRepublicApiService.websocket';
import { TradeRepublicCredentials } from './TradeRepublicCredentials';

/** Session expiration buffer (30 seconds before actual expiration) */
const SESSION_EXPIRATION_BUFFER_MS = 30 * 1000;

/** Default timeout for WebSocket subscriptions (30 seconds) */
const SUBSCRIPTION_TIMEOUT_MS = 30_000;

/** Retry configuration per ADR-001 */
const RETRY_CONFIG = {
  /** Number of retry attempts */
  retries: 3,
  /** Minimum delay between retries (1 second) */
  minTimeout: 1000,
  /** Maximum delay between retries (10 seconds) */
  maxTimeout: 10000,
  /** Backoff multiplier (exponential factor) */
  factor: 2,
} as const;

/**
 * TradeRepublicApiService provides the main interface for interacting with
 * the Trade Republic API.
 *
 * Usage:
 * 1. Create service with credentials
 * 2. Call connect(twoFactorCode) to authenticate
 * 3. Use subscribeAndWait() for data retrieval
 * 4. Call disconnect() when done
 */
export class TradeRepublicApiService {
  private keyPair: KeyPair | null = null;
  private authStatus: AuthStatus = AuthStatus.UNAUTHENTICATED;
  private processId: string | null = null;
  private cookies: StoredCookie[] = [];
  private sessionExpiresAt: number = 0;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private errorHandlers: ((error: Error | WebSocketMessage) => void)[] = [];
  private initialized = false;
  private refreshPromise: Promise<void> | null = null;

  /** Throttled fetch function - max 1 request per second (per ADR-001) */
  private readonly throttledFetch: typeof fetch;

  /** Crypto manager for key generation and signing */
  private readonly cryptoManager: CryptoManager;

  /** WebSocket manager for real-time communication */
  private readonly webSocketManager: WebSocketManager;

  constructor(private readonly credentials: TradeRepublicCredentials) {
    // Initialize CryptoManager with default config directory
    const configDir = path.join(os.homedir(), DEFAULT_CONFIG_DIR);
    this.cryptoManager = new CryptoManager(configDir);

    // Initialize WebSocketManager
    this.webSocketManager = new WebSocketManager();

    // Rate limit: 1 request per second (per ADR-001)
    const throttle = pThrottle({ limit: 1, interval: 1000 });

    // Compose: throttle(retry(fetch))
    // Each retry attempt respects rate limiting
    const retryFetch = this.createRetryFetch();
    this.throttledFetch = throttle((...args: Parameters<typeof fetch>) =>
      retryFetch(...args),
    ) as typeof fetch;

    // Forward WebSocket events
    this.webSocketManager.on('message', (message: WebSocketMessage) => {
      this.messageHandlers.forEach((handler) => {
        handler(message);
      });
    });
    this.webSocketManager.on('error', (error: Error | WebSocketMessage) => {
      this.errorHandlers.forEach((handler) => {
        handler(error);
      });
    });
  }

  /**
   * Connects to the Trade Republic API with 2FA verification.
   * Handles initialization, login, and 2FA in one call.
   *
   * @internal This method is for testing only. For MCP tools, use subscribeAndWait
   * which handles lazy authentication and enterTwoFactorCode for 2FA verification.
   * @param twoFactorCode - The 2FA code received via SMS
   */
  public async connect(twoFactorCode: string): Promise<void> {
    // Validate 2FA code
    const validationResult = TwoFactorCodeSchema.safeParse({
      code: twoFactorCode,
    });
    if (!validationResult.success) {
      throw new AuthenticationError(
        `Invalid 2FA code: ${validationResult.error.message}`,
      );
    }

    await this.initialize();
    await this.login();
    await this.verify2FA(validationResult.data.code);
  }

  /**
   * Enters the two-factor authentication code.
   * This method never throws - it always returns a message indicating success or failure.
   *
   * @param request - The request containing the 2FA code
   * @returns Response with a message indicating success or failure
   */
  public async enterTwoFactorCode(
    request: EnterTwoFactorCodeRequest,
  ): Promise<EnterTwoFactorCodeResponse> {
    // Validate request
    const validationResult = EnterTwoFactorCodeRequestSchema.safeParse(request);
    if (!validationResult.success) {
      return { message: 'Code is required' };
    }

    // Check if already authenticated
    if (this.authStatus === AuthStatus.AUTHENTICATED) {
      return { message: 'Already authenticated' };
    }

    // Check if awaiting 2FA
    if (this.authStatus !== AuthStatus.AWAITING_2FA) {
      return {
        message: 'Not awaiting 2FA verification. Initiate login first.',
      };
    }

    try {
      await this.verify2FA(validationResult.data.code);
      return { message: 'Authentication successful' };
    } catch (error) {
      // p-retry guarantees all thrown values are Error instances
      return { message: (error as Error).message };
    }
  }

  /**
   * Initializes the service by loading or generating ECDSA key pair.
   */
  private async initialize(): Promise<void> {
    logger.api.info('Initializing TradeRepublicApiService');

    if (await this.cryptoManager.hasStoredKeyPair()) {
      logger.api.info('Loading existing key pair');
      this.keyPair = await this.cryptoManager.loadKeyPair();
    } else {
      logger.api.info('Generating new key pair');
      this.keyPair = await this.cryptoManager.generateKeyPair();
      await this.cryptoManager.saveKeyPair(this.keyPair);
    }

    this.initialized = true;
    logger.api.info('TradeRepublicApiService initialized');
  }

  /**
   * Initiates login with stored credentials.
   */
  private async login(): Promise<void> {
    this.ensureInitialized();

    const { phoneNumber, pin } = this.credentials;

    logger.api.info(`Initiating login for ${phoneNumber.substring(0, 6)}...`);

    const response = await this.throttledFetch(`${TR_API_URL}/auth/web/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber,
        pin,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const parsed = ErrorResponseSchema.safeParse(errorData);
      const message = parsed.success
        ? parsed.data.message || parsed.data.errorMessage || 'Login failed'
        : 'Login failed';
      throw new AuthenticationError(message, `HTTP_${response.status}`);
    }

    const data = await response.json();
    const parsed = LoginResponseSchema.parse(data);

    this.processId = parsed.processId;
    this.authStatus = AuthStatus.AWAITING_2FA;

    logger.api.info('Login initiated, awaiting 2FA code');
  }

  /**
   * Completes 2FA verification with the code received via SMS.
   * Precondition: Must be called when authStatus === AWAITING_2FA (ensured by callers)
   */
  private async verify2FA(code: string): Promise<void> {
    const keyPair = this.ensureInitialized();

    logger.api.info('Verifying 2FA code');

    const publicKeyBase64 = this.cryptoManager.getPublicKeyBase64(
      keyPair.publicKeyPem,
    );

    const response = await this.throttledFetch(
      `${TR_API_URL}/auth/web/login/${this.processId}/${code}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceKey: publicKeyBase64,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      const parsed = ErrorResponseSchema.safeParse(errorData);
      const message = parsed.success
        ? parsed.data.message ||
          parsed.data.errorMessage ||
          '2FA verification failed'
        : '2FA verification failed';
      throw new AuthenticationError(message, `HTTP_${response.status}`);
    }

    // Parse cookies from Set-Cookie headers (cookie-based auth per pytr)
    this.cookies = this.parseCookiesFromResponse(response);
    if (this.cookies.length === 0) {
      throw new AuthenticationError('No cookies received from 2FA response');
    }

    // Session expiry: 290 seconds per pytr
    this.sessionExpiresAt = Date.now() + DEFAULT_SESSION_DURATION_MS;

    this.authStatus = AuthStatus.AUTHENTICATED;

    logger.api.info('2FA verified, connecting to WebSocket');

    // Connect WebSocket with cookies as header
    const cookieHeader = this.getCookieHeader();
    await this.webSocketManager.connect(cookieHeader);

    logger.api.info('Authentication complete');
  }

  /**
   * Refreshes the session using cookies.
   * Per pytr: uses GET request with cookies, refreshes cookies from response.
   * Precondition: Called only from ensureValidSession which guarantees auth status.
   */
  private async refreshSession(): Promise<void> {
    this.ensureInitialized();

    logger.api.info('Refreshing session');

    const response = await this.throttledFetch(
      `${TR_API_URL}/auth/web/session`,
      {
        method: 'GET',
        headers: {
          Cookie: this.getCookieHeader(),
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      const parsed = ErrorResponseSchema.safeParse(errorData);
      const message = parsed.success
        ? parsed.data.message ||
          parsed.data.errorMessage ||
          'Session refresh failed'
        : 'Session refresh failed';
      throw new AuthenticationError(message, `HTTP_${response.status}`);
    }

    // Update cookies from response if new ones are provided
    const newCookies = this.parseCookiesFromResponse(response);
    if (newCookies.length > 0) {
      this.cookies = newCookies;
    }

    // Reset session expiry
    this.sessionExpiresAt = Date.now() + DEFAULT_SESSION_DURATION_MS;

    logger.api.info('Session refreshed');
  }

  /**
   * Ensures the session is valid, refreshing if needed.
   * Uses a mutex pattern to prevent concurrent refresh requests.
   */
  private async ensureValidSession(): Promise<void> {
    this.ensureInitialized();

    // Throw if initialized but not authenticated (e.g., validateSession called after 2FA initiated)
    if (this.authStatus !== AuthStatus.AUTHENTICATED || !this.hasCookies()) {
      throw new AuthenticationError('Not authenticated');
    }

    // Check if session is about to expire
    if (Date.now() >= this.sessionExpiresAt - SESSION_EXPIRATION_BUFFER_MS) {
      // If refresh already in progress, wait for it
      if (this.refreshPromise) {
        await this.refreshPromise;
        return;
      }

      // Start refresh and store promise
      this.refreshPromise = this.refreshSession().finally(() => {
        this.refreshPromise = null;
      });

      await this.refreshPromise;
    }
  }

  /**
   * Ensures the user is authenticated, initiating login if needed.
   * Throws TwoFactorCodeRequiredException if 2FA is required.
   */
  private async ensureAuthenticatedOrThrow(): Promise<void> {
    // If already authenticated, just ensure session is valid
    if (this.authStatus === AuthStatus.AUTHENTICATED) {
      await this.ensureValidSession();
      return;
    }

    // If awaiting 2FA, throw exception to prompt user
    if (this.authStatus === AuthStatus.AWAITING_2FA) {
      throw new TwoFactorCodeRequiredException(
        this.credentials.getMaskedPhoneNumber(),
      );
    }

    // Not authenticated - initiate login flow
    await this.initialize();
    await this.login();

    // Now in AWAITING_2FA state - throw exception
    throw new TwoFactorCodeRequiredException(
      this.credentials.getMaskedPhoneNumber(),
    );
  }

  /**
   * Subscribes to a topic with optional payload.
   * Returns the subscription ID.
   */
  public subscribe(input: SubscribeRequestInput): number {
    const validationResult = SubscribeRequestSchema.safeParse(input);
    if (!validationResult.success) {
      throw new TradeRepublicError(
        `Invalid subscription request: ${validationResult.error.message}`,
      );
    }
    return this.webSocketManager.subscribe(
      validationResult.data.topic,
      validationResult.data.payload,
    );
  }

  /**
   * Unsubscribes from a subscription by ID.
   */
  public unsubscribe(subscriptionId: number): void {
    this.webSocketManager.unsubscribe(subscriptionId);
  }

  /**
   * Returns the current authentication status.
   *
   * @internal This method is for testing and debugging purposes only.
   * MCP tools do not need to call this method directly.
   */
  public getAuthStatus(): AuthStatus {
    return this.authStatus;
  }

  /**
   * Validates that the session is still valid, refreshing if needed.
   * Useful for health checks or before batches of operations.
   */
  public async validateSession(): Promise<void> {
    await this.ensureValidSession();
  }

  /**
   * Subscribe to a WebSocket topic and wait for a response.
   * This is the primary method for making API calls via WebSocket.
   *
   * Automatically handles authentication:
   * - If not authenticated, initiates login flow and throws TwoFactorCodeRequiredException
   * - If authenticated, ensures session is valid before making the request
   *
   * @param topic - The WebSocket topic to subscribe to
   * @param payload - Optional payload to send with the subscription
   * @param schema - Zod schema to validate and transform the response
   * @returns Parsed and validated response data
   * @throws TwoFactorCodeRequiredException if authentication is required
   */
  public async subscribeAndWait<T>(
    topic: string,
    payload: Record<string, unknown>,
    schema: {
      safeParse: (
        data: unknown,
      ) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): Promise<T> {
    // Ensure authenticated before making any API call
    await this.ensureAuthenticatedOrThrow();

    return new Promise((resolve, reject) => {
      let subscriptionId: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      let resolved = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.offMessage(messageHandler);
        this.offError(errorHandler);
        if (subscriptionId !== null) {
          try {
            this.unsubscribe(subscriptionId);
          } catch {
            // Ignore unsubscribe errors during cleanup
          }
        }
      };

      const messageHandler = (message: WebSocketMessage): void => {
        if (resolved || message.id !== subscriptionId) {
          return;
        }

        if (message.code === MESSAGE_CODE.E) {
          resolved = true;
          cleanup();
          const errorPayload = message.payload as
            | { message?: string }
            | undefined;
          const errorMessage = errorPayload?.message || 'API error';
          logger.api.error(
            { payload: message.payload },
            `${topic} subscription error`,
          );
          reject(new TradeRepublicError(errorMessage));
          return;
        }

        if (message.code === MESSAGE_CODE.A) {
          resolved = true;
          cleanup();
          const parseResult = schema.safeParse(message.payload);
          if (parseResult.success) {
            logger.api.debug({ topic }, 'Received subscription data');
            resolve(parseResult.data);
          } else {
            logger.api.error(
              { err: parseResult.error },
              `Failed to parse ${topic} response`,
            );
            reject(new TradeRepublicError(`Invalid ${topic} response format`));
          }
        }
      };

      const errorHandler = (error: Error | WebSocketMessage): void => {
        // Guard against race condition: error arrives after message resolved
        if (resolved) {
          return;
        }
        if (error instanceof Error) {
          resolved = true;
          cleanup();
          reject(error);
        } else if (error.id === subscriptionId) {
          resolved = true;
          cleanup();
          const errorPayload = error.payload as
            | { message?: string }
            | undefined;
          reject(
            new TradeRepublicError(
              errorPayload?.message || String(error.payload),
            ),
          );
        }
      };

      this.onMessage(messageHandler);
      this.onError(errorHandler);

      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          logger.api.error(
            `${topic} subscription timed out after ${SUBSCRIPTION_TIMEOUT_MS}ms`,
          );
          reject(new TradeRepublicError(`${topic} request timed out`));
        }
      }, SUBSCRIPTION_TIMEOUT_MS);

      try {
        subscriptionId = this.subscribe({ topic, payload });
        logger.api.debug(
          { topic, subscriptionId, payload },
          'Subscribed to topic',
        );
      } catch (error) {
        resolved = true;
        cleanup();
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new TradeRepublicError(String(error)));
        }
      }
    });
  }

  /**
   * Disconnects from the API and cleans up resources.
   *
   * @internal This method is for testing and cleanup purposes only.
   * MCP tools do not need to call this method directly.
   */
  public disconnect(): void {
    logger.api.info('Disconnecting from Trade Republic API');
    this.webSocketManager.disconnect();
    this.authStatus = AuthStatus.UNAUTHENTICATED;
    this.cookies = [];
    this.sessionExpiresAt = 0;
    this.processId = null;
  }

  /**
   * Registers a handler for incoming WebSocket messages.
   */
  public onMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Registers a handler for errors.
   */
  public onError(handler: (error: Error | WebSocketMessage) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Removes a message handler.
   */
  public offMessage(handler: (message: WebSocketMessage) => void): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * Removes an error handler.
   */
  public offError(handler: (error: Error | WebSocketMessage) => void): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index !== -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  /**
   * Ensures the service has been initialized.
   * Returns the keyPair to provide type-safe access.
   */
  private ensureInitialized(): KeyPair {
    if (!this.initialized || !this.keyPair) {
      throw new TradeRepublicError(
        'Service not initialized. Call initialize() first.',
      );
    }
    return this.keyPair;
  }

  /**
   * Creates a fetch function wrapper with exponential backoff retry logic.
   * Retries on 5xx server errors and 429 rate limit.
   * Does NOT retry on 4xx client errors (except 429).
   */
  private createRetryFetch(): typeof fetch {
    return async (
      url: string | URL | globalThis.Request,
      init?: RequestInit,
    ): Promise<Response> => {
      return pRetry(
        async () => {
          const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
          });

          // Don't retry 4xx client errors (except 429 rate limit)
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            // Return response as-is, let caller handle error
            return response;
          }

          // Retry on 5xx server errors and 429 rate limit
          if (response.status >= 500 || response.status === 429) {
            throw new Error(`HTTP ${response.status}`);
          }

          return response;
        },
        {
          retries: RETRY_CONFIG.retries,
          minTimeout: RETRY_CONFIG.minTimeout,
          maxTimeout: RETRY_CONFIG.maxTimeout,
          factor: RETRY_CONFIG.factor,
          onFailedAttempt: (error) => {
            logger.api.warn(
              { attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
              `Request failed, retrying...`,
            );
          },
        },
      );
    };
  }

  /**
   * Checks if cookies are available.
   */
  private hasCookies(): boolean {
    return this.cookies.length > 0;
  }

  /**
   * Gets the cookie header string for HTTP requests.
   * Only includes cookies for traderepublic.com domain.
   */
  private getCookieHeader(): string {
    return this.cookies
      .filter((c) => c.domain.endsWith('traderepublic.com'))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  /**
   * Parses Set-Cookie headers from a fetch Response.
   * Returns an array of StoredCookie objects.
   */
  private parseCookiesFromResponse(response: Response): StoredCookie[] {
    const cookies: StoredCookie[] = [];

    // Headers may be undefined in mocked responses during testing
    const headers = response.headers as Headers | undefined;
    if (!headers) {
      return cookies;
    }

    let setCookieHeaders: string[] = [];

    // Try getSetCookie() first (available in newer Node.js versions)
    if (typeof headers.getSetCookie === 'function') {
      setCookieHeaders = headers.getSetCookie();
    } else if (typeof headers.get === 'function') {
      // Fallback: get 'set-cookie' header (may be comma-separated)
      const setCookieHeader = headers.get('set-cookie');
      if (setCookieHeader) {
        // Simple split - this may not work for cookies with commas in values,
        // but Trade Republic cookies are simple key=value pairs
        setCookieHeaders = setCookieHeader.split(/,(?=\s*\w+=)/);
      }
    }

    for (const cookieStr of setCookieHeaders) {
      const parsed = this.parseSingleCookie(cookieStr);
      if (parsed) {
        cookies.push(parsed);
      }
    }

    return cookies;
  }

  /**
   * Parses a single Set-Cookie header string.
   */
  private parseSingleCookie(cookieStr: string): StoredCookie | null {
    const parts = cookieStr.split(';').map((p) => p.trim());

    // First part is name=value
    const [nameValue, ...attributes] = parts;
    const eqIndex = nameValue.indexOf('=');
    if (eqIndex === -1) {
      return null;
    }

    const name = nameValue.substring(0, eqIndex).trim();
    const value = nameValue.substring(eqIndex + 1).trim();

    if (!name) {
      return null;
    }

    // Parse attributes
    let domain = 'traderepublic.com'; // Default domain
    let path = '/';
    let expires: Date | undefined;

    for (const attr of attributes) {
      const [attrName, attrValue] = attr.split('=').map((s) => s.trim());
      const attrNameLower = attrName.toLowerCase();

      if (attrNameLower === 'domain' && attrValue) {
        domain = attrValue.startsWith('.') ? attrValue.substring(1) : attrValue;
      } else if (attrNameLower === 'path' && attrValue) {
        path = attrValue;
      } else if (attrNameLower === 'expires' && attrValue) {
        const parsedDate = new Date(attrValue);
        if (!isNaN(parsedDate.getTime())) {
          expires = parsedDate;
        }
      }
    }

    return { name, value, domain, path, expires };
  }
}
