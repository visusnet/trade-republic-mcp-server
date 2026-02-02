/**
 * Trade Republic API Service
 *
 * Main service for interacting with the Trade Republic API.
 * Handles authentication, session management, and WebSocket communication.
 */

import pThrottle from 'p-throttle';

import { logger } from '../../logger';
import type { CryptoManager } from './TradeRepublicApiService.crypto';
import {
  CredentialsSchema,
  SubscribeRequestSchema,
  TwoFactorCodeSchema,
  type CredentialsInput,
  type SubscribeRequestInput,
  type TwoFactorCodeInput,
} from './TradeRepublicApiService.request';
import {
  ErrorResponseSchema,
  LoginResponseSchema,
} from './TradeRepublicApiService.response';
import {
  AuthenticationError,
  AuthStatus,
  DEFAULT_SESSION_DURATION_MS,
  TR_API_URL,
  TradeRepublicError,
  type FetchFunction,
  type KeyPair,
  type StoredCookie,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import type { WebSocketManager } from './TradeRepublicApiService.websocket';

/** Session expiration buffer (30 seconds before actual expiration) */
const SESSION_EXPIRATION_BUFFER_MS = 30 * 1000;

/**
 * TradeRepublicApiService provides the main interface for interacting with
 * the Trade Republic API.
 *
 * Usage:
 * 1. Create service with dependencies
 * 2. Call initialize() to load/generate keys
 * 3. Call login() with phone/PIN
 * 4. Call verify2FA() with the code received via SMS
 * 5. Use subscribe() for real-time data
 * 6. Call disconnect() when done
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

  /** Throttled fetch function - max 1 request per second (per ADR-001) */
  private readonly throttledFetch: FetchFunction;

  constructor(
    private readonly crypto: CryptoManager,
    private readonly ws: WebSocketManager,
    private readonly fetchFn: FetchFunction,
  ) {
    // Rate limit: 1 request per 1000ms (per ADR-001)
    const throttle = pThrottle({ limit: 1, interval: 1000 });
    this.throttledFetch = throttle((...args: Parameters<FetchFunction>) =>
      this.fetchFn(...args),
    ) as FetchFunction;
    // Forward WebSocket events
    this.ws.on('message', (message: WebSocketMessage) => {
      this.messageHandlers.forEach((handler) => {
        handler(message);
      });
    });
    this.ws.on('error', (error: Error | WebSocketMessage) => {
      this.errorHandlers.forEach((handler) => {
        handler(error);
      });
    });
  }

  /**
   * Initializes the service by loading or generating ECDSA key pair.
   */
  public async initialize(): Promise<void> {
    logger.api.info('Initializing TradeRepublicApiService');

    if (await this.crypto.hasStoredKeyPair()) {
      logger.api.info('Loading existing key pair');
      this.keyPair = await this.crypto.loadKeyPair();
    } else {
      logger.api.info('Generating new key pair');
      this.keyPair = await this.crypto.generateKeyPair();
      await this.crypto.saveKeyPair(this.keyPair);
    }

    this.initialized = true;
    logger.api.info('TradeRepublicApiService initialized');
  }

  /**
   * Initiates login with phone number and PIN.
   * Returns the processId needed for 2FA verification.
   */
  public async login(
    credentials: CredentialsInput,
  ): Promise<{ processId: string }> {
    this.ensureInitialized();

    // Validate credentials
    const validationResult = CredentialsSchema.safeParse(credentials);
    if (!validationResult.success) {
      throw new AuthenticationError(
        `Invalid credentials: ${validationResult.error.message}`,
      );
    }

    const { phoneNumber, pin } = validationResult.data;

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

    return { processId: parsed.processId };
  }

  /**
   * Completes 2FA verification with the code received via SMS.
   */
  public async verify2FA(input: TwoFactorCodeInput): Promise<void> {
    this.ensureInitialized();

    if (this.authStatus !== AuthStatus.AWAITING_2FA) {
      throw new AuthenticationError('Not awaiting 2FA verification');
    }

    // Validate code
    const validationResult = TwoFactorCodeSchema.safeParse(input);
    if (!validationResult.success) {
      throw new AuthenticationError(
        `Invalid 2FA code: ${validationResult.error.message}`,
      );
    }

    const { code } = validationResult.data;

    logger.api.info('Verifying 2FA code');

    // Get public key as base64 (keyPair is guaranteed to exist after ensureInitialized)
    /* istanbul ignore if -- @preserve Defensive null check */
    if (!this.keyPair) {
      throw new TradeRepublicError('Key pair not initialized');
    }
    const publicKeyBase64 = this.crypto.getPublicKeyBase64(
      this.keyPair.publicKeyPem,
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
    await this.ws.connect(cookieHeader);

    logger.api.info('Authentication complete');
  }

  /**
   * Refreshes the session using cookies.
   * Per pytr: uses GET request with cookies, refreshes cookies from response.
   */
  public async refreshSession(): Promise<void> {
    this.ensureInitialized();

    if (this.authStatus !== AuthStatus.AUTHENTICATED || !this.hasCookies()) {
      throw new AuthenticationError('Not authenticated');
    }

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
   */
  public async ensureValidSession(): Promise<void> {
    this.ensureInitialized();

    if (this.authStatus !== AuthStatus.AUTHENTICATED || !this.hasCookies()) {
      throw new AuthenticationError('Not authenticated');
    }

    // Check if session is about to expire
    if (Date.now() >= this.sessionExpiresAt - SESSION_EXPIRATION_BUFFER_MS) {
      await this.refreshSession();
    }
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
    return this.ws.subscribe(
      validationResult.data.topic,
      validationResult.data.payload,
    );
  }

  /**
   * Unsubscribes from a subscription by ID.
   */
  public unsubscribe(subscriptionId: number): void {
    this.ws.unsubscribe(subscriptionId);
  }

  /**
   * Returns the current authentication status.
   */
  public getAuthStatus(): AuthStatus {
    return this.authStatus;
  }

  /**
   * Disconnects from the API and cleans up resources.
   */
  public disconnect(): void {
    logger.api.info('Disconnecting from Trade Republic API');
    this.ws.disconnect();
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
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.keyPair) {
      throw new TradeRepublicError(
        'Service not initialized. Call initialize() first.',
      );
    }
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
