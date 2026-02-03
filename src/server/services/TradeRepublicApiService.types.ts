/**
 * Trade Republic API Service - Types, Constants, and Error Classes
 */

// =============================================================================
// Constants
// =============================================================================

/** Trade Republic WebSocket endpoint */
export const TR_WS_URL = 'wss://api.traderepublic.com';

/** Trade Republic REST API endpoint */
export const TR_API_URL = 'https://api.traderepublic.com/api/v1';

/** WebSocket message codes */
export const MESSAGE_CODE = {
  /** Answer - successful response */
  A: 'A',
  /** Delta - incremental update */
  D: 'D',
  /** Complete - subscription ended */
  C: 'C',
  /** Error - error response */
  E: 'E',
} as const;

export type MessageCode = (typeof MESSAGE_CODE)[keyof typeof MESSAGE_CODE];

/** Default key storage directory */
export const DEFAULT_CONFIG_DIR = '.trade-republic-mcp';

/** Key file name */
export const KEY_FILE_NAME = 'keys.json';

// =============================================================================
// Enums
// =============================================================================

/** Authentication status */
export enum AuthStatus {
  /** Not authenticated */
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  /** Awaiting 2FA code */
  AWAITING_2FA = 'AWAITING_2FA',
  /** Fully authenticated */
  AUTHENTICATED = 'AUTHENTICATED',
}

/** WebSocket connection status */
export enum ConnectionStatus {
  /** Not connected */
  DISCONNECTED = 'DISCONNECTED',
  /** Connection in progress */
  CONNECTING = 'CONNECTING',
  /** Connected and ready */
  CONNECTED = 'CONNECTED',
}

// =============================================================================
// Error Classes
// =============================================================================

/** Base error class for Trade Republic API errors */
export class TradeRepublicError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'TradeRepublicError';
  }
}

/** Authentication-specific errors */
export class AuthenticationError extends TradeRepublicError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'AuthenticationError';
  }
}

/** WebSocket-specific errors */
export class WebSocketError extends TradeRepublicError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'WebSocketError';
  }
}

/** Exception thrown when two-factor authentication is required */
export class TwoFactorCodeRequiredException extends TradeRepublicError {
  constructor(maskedPhoneNumber: string) {
    super(
      `2FA code required. A code has been sent to ${maskedPhoneNumber}. Call enter_two_factor_code with the code.`,
      'TWO_FACTOR_REQUIRED',
    );
    this.name = 'TwoFactorCodeRequiredException';
  }
}

// =============================================================================
// Interfaces
// =============================================================================

/** ECDSA key pair */
export interface KeyPair {
  /** PEM-encoded private key */
  privateKeyPem: string;
  /** PEM-encoded public key */
  publicKeyPem: string;
}

/** Stored cookie from Set-Cookie header */
export interface StoredCookie {
  /** Cookie name */
  name: string;
  /** Cookie value */
  value: string;
  /** Cookie domain */
  domain: string;
  /** Cookie path */
  path: string;
  /** Cookie expiration date */
  expires?: Date;
}

/** Default session duration (290 seconds per pytr) */
export const DEFAULT_SESSION_DURATION_MS = 290_000;

/** HTTP request timeout in milliseconds (10 seconds, matches pytr) */
export const HTTP_TIMEOUT_MS = 10_000;

/** Parsed WebSocket message */
export interface WebSocketMessage {
  /** Subscription ID */
  id: number;
  /** Message code (A/D/C/E) */
  code: MessageCode;
  /** Message payload */
  payload: unknown;
}

/** Signed payload for authentication */
export interface SignedPayload {
  /** Timestamp in ISO format */
  timestamp: string;
  /** Request data */
  data: object;
  /** Base64-encoded signature */
  signature: string;
}

/** WebSocket connection options */
export interface WebSocketOptions {
  /** HTTP headers to send with WebSocket handshake */
  headers?: Record<string, string>;
}

/** WebSocket event types for undici/browser API */
export interface WebSocketOpenEvent {
  type: 'open';
}

export interface WebSocketMessageEvent {
  type: 'message';
  data: string | Buffer;
}

export interface WebSocketCloseEvent {
  type: 'close';
  code: number;
  reason: string;
}

export interface WebSocketErrorEvent {
  type: 'error';
  error?: Error;
  message?: string;
}

/** WebSocket interface for dependency injection (undici/browser API) */
export interface WebSocket {
  readonly readyState: number;
  readonly OPEN: number;
  readonly CLOSED: number;
  readonly CONNECTING: number;
  readonly CLOSING: number;
  send(data: string): void;
  close(): void;
  addEventListener(
    event: 'open',
    listener: (event: WebSocketOpenEvent) => void,
  ): void;
  addEventListener(
    event: 'message',
    listener: (event: WebSocketMessageEvent) => void,
  ): void;
  addEventListener(
    event: 'error',
    listener: (event: WebSocketErrorEvent) => void,
  ): void;
  addEventListener(
    event: 'close',
    listener: (event: WebSocketCloseEvent) => void,
  ): void;
  removeEventListener(
    event: string,
    listener: (...args: unknown[]) => void,
  ): void;
}

/** HTTP fetch function type */
export type FetchFunction = typeof fetch;
