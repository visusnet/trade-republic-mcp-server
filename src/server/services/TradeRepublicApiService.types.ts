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

/** User credentials for login */
export interface Credentials {
  /** Phone number in E.164 format (e.g., +49123456789) */
  phoneNumber: string;
  /** 4-digit PIN */
  pin: string;
}

/** Session tokens (deprecated - kept for compatibility) */
export interface SessionTokens {
  /** Refresh token for obtaining new session tokens */
  refreshToken: string;
  /** Session token for WebSocket authentication */
  sessionToken: string;
  /** Token expiration timestamp (milliseconds) */
  expiresAt: number;
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

/** WebSocket factory function type */
export type WebSocketFactory = (
  url: string,
  options?: WebSocketOptions,
) => WebSocket;

/** WebSocket interface for dependency injection */
export interface WebSocket {
  readonly readyState: number;
  readonly OPEN: number;
  readonly CLOSED: number;
  readonly CONNECTING: number;
  readonly CLOSING: number;
  send(data: string): void;
  close(): void;
  on(event: 'open', listener: () => void): this;
  on(event: 'message', listener: (data: Buffer | string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
  removeAllListeners(): this;
}

/** HTTP fetch function type */
export type FetchFunction = typeof fetch;

/** File system operations interface */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}
