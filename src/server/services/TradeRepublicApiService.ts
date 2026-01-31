/**
 * Trade Republic API Service
 *
 * Main service for interacting with the Trade Republic API.
 * Handles authentication, session management, and WebSocket communication.
 */

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
  RefreshTokenResponseSchema,
  TokenResponseSchema,
} from './TradeRepublicApiService.response';
import {
  AuthenticationError,
  AuthStatus,
  TR_API_URL,
  TradeRepublicError,
  type FetchFunction,
  type KeyPair,
  type SessionTokens,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import type { WebSocketManager } from './TradeRepublicApiService.websocket';

/** Session token expiration buffer (5 minutes before actual expiration) */
const SESSION_EXPIRATION_BUFFER_MS = 5 * 60 * 1000;

/** Default session duration (55 minutes) */
const DEFAULT_SESSION_DURATION_MS = 55 * 60 * 1000;

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
  private sessionTokens: SessionTokens | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private errorHandlers: ((error: Error | WebSocketMessage) => void)[] = [];
  private initialized = false;

  constructor(
    private readonly crypto: CryptoManager,
    private readonly ws: WebSocketManager,
    private readonly fetchFn: FetchFunction,
  ) {
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

    const response = await this.fetchFn(`${TR_API_URL}/auth/web/login`, {
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

    const response = await this.fetchFn(
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

    const data = await response.json();
    const parsed = TokenResponseSchema.parse(data);

    this.sessionTokens = {
      refreshToken: parsed.refreshToken,
      sessionToken: parsed.sessionToken,
      expiresAt: Date.now() + DEFAULT_SESSION_DURATION_MS,
    };

    this.authStatus = AuthStatus.AUTHENTICATED;

    logger.api.info('2FA verified, connecting to WebSocket');

    // Connect WebSocket with session token
    await this.ws.connect(this.sessionTokens.sessionToken);

    logger.api.info('Authentication complete');
  }

  /**
   * Refreshes the session token using the refresh token.
   */
  public async refreshSession(): Promise<void> {
    this.ensureInitialized();

    if (this.authStatus !== AuthStatus.AUTHENTICATED || !this.sessionTokens) {
      throw new AuthenticationError('Not authenticated');
    }

    logger.api.info('Refreshing session token');

    const response = await this.fetchFn(`${TR_API_URL}/auth/web/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sessionTokens.refreshToken}`,
      },
    });

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

    const data = await response.json();
    const parsed = RefreshTokenResponseSchema.parse(data);

    this.sessionTokens = {
      ...this.sessionTokens,
      sessionToken: parsed.sessionToken,
      expiresAt: Date.now() + DEFAULT_SESSION_DURATION_MS,
    };

    logger.api.info('Session token refreshed');
  }

  /**
   * Ensures the session is valid, refreshing if needed.
   */
  public async ensureValidSession(): Promise<void> {
    this.ensureInitialized();

    if (this.authStatus !== AuthStatus.AUTHENTICATED || !this.sessionTokens) {
      throw new AuthenticationError('Not authenticated');
    }

    // Check if session is about to expire
    if (
      Date.now() >=
      this.sessionTokens.expiresAt - SESSION_EXPIRATION_BUFFER_MS
    ) {
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
    this.sessionTokens = null;
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
}
