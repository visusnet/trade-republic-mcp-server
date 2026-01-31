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
  type WebSocketFactory,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';

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

  constructor(private readonly wsFactory: WebSocketFactory) {
    super();
  }

  /**
   * Establishes a WebSocket connection with the given session token.
   */
  async connect(sessionToken: string): Promise<void> {
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
        this.ws = this.wsFactory(TR_WS_URL);

        this.ws.on('open', () => {
          this.status = ConnectionStatus.CONNECTED;
          logger.api.info('WebSocket connected');
          this.sendConnectMessage(sessionToken);
          settle(() => {
            resolve();
          });
        });

        this.ws.on('message', (data: Buffer | string) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          logger.api.error(`WebSocket error: ${error.message}`);
          const wasConnecting = this.status === ConnectionStatus.CONNECTING;
          this.status = ConnectionStatus.DISCONNECTED;
          if (wasConnecting) {
            settle(() => {
              reject(error);
            });
          } else {
            this.emit('error', error);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          const reasonStr = reason.toString();
          logger.api.info(`WebSocket closed: ${code} ${reasonStr}`);
          const wasConnecting = this.status === ConnectionStatus.CONNECTING;
          this.status = ConnectionStatus.DISCONNECTED;
          if (wasConnecting) {
            settle(() => {
              reject(
                new WebSocketError(`Connection closed: ${code} ${reasonStr}`),
              );
            });
          }
        });
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
  disconnect(): void {
    if (this.ws) {
      logger.api.info('Disconnecting WebSocket');
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.status = ConnectionStatus.DISCONNECTED;
  }

  /**
   * Returns the current connection status.
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Subscribes to a topic with optional payload.
   * Returns the subscription ID.
   */
  subscribe(topic: string, payload?: object): number {
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
  unsubscribe(subscriptionId: number): void {
    if (!this.ws || this.status !== ConnectionStatus.CONNECTED) {
      throw new WebSocketError('Not connected');
    }

    const messageStr = `unsub ${subscriptionId}`;
    logger.api.debug(`Unsubscribing: ${messageStr}`);
    this.ws.send(messageStr);
  }

  /**
   * Sends the initial connection message with session token.
   */
  private sendConnectMessage(sessionToken: string): void {
    const connectPayload = {
      locale: 'en',
      platformId: 'webtrading',
      platformVersion: 'chrome - 120.0.0',
      clientId: 'app.traderepublic.com',
      clientVersion: '1.0.0',
      sessionToken,
    };
    const message = `connect 31 ${JSON.stringify(connectPayload)}`;
    logger.api.debug(`Sending connect message`);
    this.ws?.send(message);
  }

  /**
   * Handles incoming WebSocket messages.
   */
  private handleMessage(data: Buffer | string): void {
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
   * Parses a raw WebSocket message into a structured format.
   * Message format: "{id} {code} {json}"
   */
  private parseMessage(messageStr: string): WebSocketMessage {
    // Match: number, space, single letter (A/D/C/E), space, rest is JSON
    const match = messageStr.match(/^(\d+)\s+([ADCE])\s+(.*)$/);

    if (!match) {
      throw new WebSocketError(
        `Invalid message format: ${messageStr.substring(0, 50)}`,
      );
    }

    const [, idStr, code, jsonStr] = match;
    const id = parseInt(idStr, 10);

    let payload: unknown;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      throw new WebSocketError(
        `Invalid JSON in message: ${jsonStr.substring(0, 50)}`,
      );
    }

    return {
      id,
      code: code as MessageCode,
      payload,
    };
  }
}
