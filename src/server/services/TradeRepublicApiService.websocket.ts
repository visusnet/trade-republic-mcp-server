/**
 * Trade Republic API Service - WebSocketManager
 *
 * Handles WebSocket connection, subscription management, and message parsing.
 */

import { EventEmitter } from 'events';

import { logger } from '../../logger';
import {
  ConnectionStatus,
  MESSAGE_CODE,
  TR_WS_URL,
  WebSocketError,
  type MessageCode,
  type WebSocket,
  type WebSocketCloseEvent,
  type WebSocketErrorEvent,
  type WebSocketFactory,
  type WebSocketMessage,
  type WebSocketMessageEvent,
  type WebSocketOpenEvent,
  type WebSocketOptions,
} from './TradeRepublicApiService.types';

/** Heartbeat check interval in milliseconds (20s, matching pytr) */
const HEARTBEAT_CHECK_MS = 20_000;

/** Connection timeout in milliseconds (40s, 2x heartbeat interval) */
const CONNECTION_TIMEOUT_MS = 40_000;

/**
 * Manages WebSocket connection to Trade Republic API.
 *
 * Extends EventEmitter to emit:
 * - 'message': Parsed WebSocket messages (WebSocketMessage)
 * - 'error': Error events (Error or WebSocketMessage with code E)
 */
export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private nextSubscriptionId = 1;
  private previousResponses: Map<number, string> = new Map();
  private lastMessageTime = Date.now();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  // Store bound event handlers for proper cleanup
  private openHandler: ((event: WebSocketOpenEvent) => void) | null = null;
  private messageHandler: ((event: WebSocketMessageEvent) => void) | null =
    null;
  private errorHandler: ((event: WebSocketErrorEvent) => void) | null = null;
  private closeHandler: ((event: WebSocketCloseEvent) => void) | null = null;

  constructor(private readonly wsFactory: WebSocketFactory) {
    super();
  }

  /**
   * Starts the heartbeat interval to check for connection health.
   * If no message is received within CONNECTION_TIMEOUT_MS, the connection is considered dead.
   */
  private startHeartbeat(): void {
    this.lastMessageTime = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastMessageTime >= CONNECTION_TIMEOUT_MS) {
        this.handleConnectionDead();
      }
    }, HEARTBEAT_CHECK_MS);
  }

  /**
   * Stops the heartbeat interval.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handles a dead connection by disconnecting and emitting an error.
   */
  private handleConnectionDead(): void {
    logger.api.warn('Connection dead - no message received in 40s');
    this.disconnect();
    this.emit('error', new WebSocketError('Connection timeout'));
  }

  /**
   * Establishes a WebSocket connection with cookie-based authentication.
   * The cookies are passed as HTTP headers during the WebSocket handshake.
   */
  public async connect(cookieHeader: string): Promise<void> {
    if (this.status !== ConnectionStatus.DISCONNECTED) {
      throw new WebSocketError('Already connected or connecting');
    }

    this.status = ConnectionStatus.CONNECTING;
    logger.api.info(`Connecting to WebSocket at ${TR_WS_URL}`);

    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (fn: () => void): void => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      try {
        const options: WebSocketOptions = cookieHeader
          ? { headers: { Cookie: cookieHeader } }
          : {};
        this.ws = this.wsFactory(TR_WS_URL, options);

        this.openHandler = () => {
          this.status = ConnectionStatus.CONNECTED;
          logger.api.info('WebSocket connected');
          this.sendConnectMessage();
          this.startHeartbeat();
          settle(() => {
            resolve();
          });
        };

        this.messageHandler = (event: WebSocketMessageEvent) => {
          this.handleMessage(event.data);
        };

        this.errorHandler = (event: WebSocketErrorEvent) => {
          const errorMessage =
            event.error?.message ?? event.message ?? 'Unknown WebSocket error';
          logger.api.error(`WebSocket error: ${errorMessage}`);
          const wasConnecting = this.status === ConnectionStatus.CONNECTING;
          this.stopHeartbeat();
          this.status = ConnectionStatus.DISCONNECTED;
          if (wasConnecting) {
            settle(() => {
              reject(event.error ?? new Error(errorMessage));
            });
          } else {
            this.emit('error', event.error ?? new Error(errorMessage));
          }
        };

        this.closeHandler = (event: WebSocketCloseEvent) => {
          const reasonStr = event.reason;
          logger.api.info(`WebSocket closed: ${event.code} ${reasonStr}`);
          const wasConnecting = this.status === ConnectionStatus.CONNECTING;
          this.stopHeartbeat();
          this.status = ConnectionStatus.DISCONNECTED;
          if (wasConnecting) {
            settle(() => {
              reject(
                new WebSocketError(
                  `Connection closed: ${event.code} ${reasonStr}`,
                ),
              );
            });
          }
        };

        this.ws.addEventListener('open', this.openHandler);
        this.ws.addEventListener('message', this.messageHandler);
        this.ws.addEventListener('error', this.errorHandler);
        this.ws.addEventListener('close', this.closeHandler);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) /* istanbul ignore next */ {
        this.status = ConnectionStatus.DISCONNECTED;
        settle(() => {
          reject(new WebSocketError('WebSocket factory error'));
        });
      }
    });
  }

  /**
   * Disconnects the WebSocket connection.
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      logger.api.info('Disconnecting WebSocket');
      // Remove event listeners
      if (this.openHandler) {
        this.ws.removeEventListener(
          'open',
          this.openHandler as (...args: unknown[]) => void,
        );
        this.openHandler = null;
      }
      if (this.messageHandler) {
        this.ws.removeEventListener(
          'message',
          this.messageHandler as (...args: unknown[]) => void,
        );
        this.messageHandler = null;
      }
      if (this.errorHandler) {
        this.ws.removeEventListener(
          'error',
          this.errorHandler as (...args: unknown[]) => void,
        );
        this.errorHandler = null;
      }
      if (this.closeHandler) {
        this.ws.removeEventListener(
          'close',
          this.closeHandler as (...args: unknown[]) => void,
        );
        this.closeHandler = null;
      }
      this.ws.close();
      this.ws = null;
    }
    this.previousResponses.clear();
    this.status = ConnectionStatus.DISCONNECTED;
  }

  /**
   * Returns the current connection status.
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Subscribes to a topic with optional payload.
   * Returns the subscription ID.
   */
  public subscribe(topic: string, payload?: object): number {
    if (!this.ws || this.status !== ConnectionStatus.CONNECTED) {
      throw new WebSocketError('Not connected');
    }

    const subId = this.nextSubscriptionId++;
    const message = {
      type: topic,
      ...payload,
    };
    const messageStr = `sub ${subId} ${JSON.stringify(message)}`;
    logger.api.debug(`Subscribing: ${messageStr}`);
    this.ws.send(messageStr);

    return subId;
  }

  /**
   * Unsubscribes from a subscription by ID.
   */
  public unsubscribe(subscriptionId: number): void {
    if (!this.ws || this.status !== ConnectionStatus.CONNECTED) {
      throw new WebSocketError('Not connected');
    }

    const messageStr = `unsub ${subscriptionId}`;
    logger.api.debug(`Unsubscribing: ${messageStr}`);
    this.ws.send(messageStr);
  }

  /**
   * Sends the initial connection message.
   * Note: Authentication is done via Cookie header, not sessionToken in payload.
   */
  private sendConnectMessage(): void {
    const connectPayload = {
      locale: 'en',
      platformId: 'webtrading',
      platformVersion: 'chrome - 120.0.0',
      clientId: 'app.traderepublic.com',
      clientVersion: '1.0.0',
    };
    const message = `connect 31 ${JSON.stringify(connectPayload)}`;
    logger.api.debug(`Sending connect message`);
    this.ws?.send(message);
  }

  /**
   * Handles incoming WebSocket messages.
   */
  private handleMessage(data: Buffer | string): void {
    this.lastMessageTime = Date.now();
    const messageStr = typeof data === 'string' ? data : data.toString();
    logger.api.debug(`Received message: ${messageStr.substring(0, 100)}...`);

    try {
      const parsed = this.parseMessage(messageStr);

      if (parsed.code === MESSAGE_CODE.E) {
        this.emit('error', parsed);
      } else {
        this.emit('message', parsed);
      }
    } catch (error) {
      logger.api.error(`Failed to parse message: ${(error as Error).message}`);
      this.emit('error', error);
    }
  }

  /**
   * Calculates the full response from a delta payload using the previous response.
   * Delta instructions are tab-separated:
   * - +text: Insert URL-decoded text (remove leading +, replace + with space, URL-decode, trim)
   * - -N: Skip N characters from previous response
   * - =N: Copy N characters from previous response
   *
   * Matches pytr's lenient parsing: unknown instructions are silently skipped.
   */
  private calculateDelta(subscriptionId: number, deltaPayload: string): string {
    const previousResponse = this.previousResponses.get(subscriptionId);
    if (previousResponse === undefined) {
      throw new WebSocketError(
        `No previous response for subscription ${subscriptionId}`,
      );
    }

    let i = 0;
    const result: string[] = [];

    for (const diff of deltaPayload.split('\t')) {
      if (diff.length === 0) {
        continue;
      }

      const sign = diff[0];
      if (sign === '+') {
        // Insert URL-decoded text (match pytr: unquote_plus + strip)
        result.push(
          decodeURIComponent(diff.substring(1).replace(/\+/g, ' ')).trim(),
        );
      } else if (sign === '-') {
        // Skip N characters
        i += parseInt(diff.substring(1), 10);
      } else if (sign === '=') {
        // Copy N characters from previous response
        const count = parseInt(diff.substring(1), 10);
        result.push(previousResponse.substring(i, i + count));
        i += count;
      }
      // Unknown signs are silently skipped (matches pytr)
    }

    return result.join('');
  }

  /**
   * Parses a raw WebSocket message into a structured format.
   * Message format: "{id} {code} {json}"
   *
   * For Delta (D) messages, the payload is decoded using the previous response.
   */
  private parseMessage(messageStr: string): WebSocketMessage {
    // Match: number, space, single letter (A/D/C/E), space, rest is payload
    // Use /s flag to allow . to match newlines in the payload
    const match = messageStr.match(/^(\d+)\s+([ADCE])\s+(.*)$/s);

    if (!match) {
      throw new WebSocketError(
        `Invalid message format: ${messageStr.substring(0, 50)}`,
      );
    }

    const [, idStr, code, payloadStr] = match;
    const id = parseInt(idStr, 10);

    let jsonStr: string;

    if (code === MESSAGE_CODE.D) {
      // Delta message: decode against previous response
      jsonStr = this.calculateDelta(id, payloadStr);
    } else {
      jsonStr = payloadStr;
    }

    // Clean up on complete
    if (code === MESSAGE_CODE.C) {
      this.previousResponses.delete(id);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      throw new WebSocketError(
        `Invalid JSON in message: ${jsonStr.substring(0, 50)}`,
      );
    }

    // Store for future delta calculations (A and D messages)
    if (code === MESSAGE_CODE.A || code === MESSAGE_CODE.D) {
      this.previousResponses.set(id, jsonStr);
    }

    return {
      id,
      code: code as MessageCode,
      payload,
    };
  }
}
