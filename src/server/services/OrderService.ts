/**
 * Order Service
 *
 * Provides methods for placing and managing orders
 * via Trade Republic API using WebSocket subscriptions.
 */

import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import type {
  PlaceOrderRequest,
  GetOrdersRequest,
  ModifyOrderRequest,
  CancelOrderRequest,
} from './OrderService.request';
import {
  PlaceOrderResponseSchema,
  GetOrdersResponseSchema,
  CancelOrderResponseSchema,
  type PlaceOrderResponse,
  type GetOrdersResponse,
  type ModifyOrderResponse,
  type CancelOrderResponse,
} from './OrderService.response';
import { OrderServiceError } from './OrderService.types';

const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 30_000;

export class OrderService {
  constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
  ) {}

  public async placeOrder(
    request: PlaceOrderRequest,
  ): Promise<PlaceOrderResponse> {
    this.ensureAuthenticated();
    logger.api.info({ request }, 'Placing order');

    const payload = this.buildOrderPayload(request);

    return this.subscribeAndWait<PlaceOrderResponse>(
      'simpleCreateOrder',
      PlaceOrderResponseSchema,
      payload,
    );
  }

  public async getOrders(
    _request?: GetOrdersRequest,
  ): Promise<GetOrdersResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting orders');
    return this.subscribeAndWait<GetOrdersResponse>(
      'orders',
      GetOrdersResponseSchema,
    );
  }

  public modifyOrder(
    _request: ModifyOrderRequest,
  ): Promise<ModifyOrderResponse> {
    this.ensureAuthenticated();
    throw new OrderServiceError(
      'Order modification is not supported by Trade Republic API. Please cancel the order and place a new one.',
      'NOT_SUPPORTED',
    );
  }

  public async cancelOrder(
    request: CancelOrderRequest,
  ): Promise<CancelOrderResponse> {
    this.ensureAuthenticated();
    logger.api.info({ orderId: request.orderId }, 'Cancelling order');
    return this.subscribeAndWait<CancelOrderResponse>(
      'cancelOrder',
      CancelOrderResponseSchema,
      { orderId: request.orderId },
    );
  }

  private subscribeAndWait<T>(
    topic: string,
    schema: {
      safeParse: (
        data: unknown,
      ) => { success: true; data: T } | { success: false; error: unknown };
    },
    payload?: Record<string, unknown>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let subscriptionId: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      let resolved = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.api.offMessage(messageHandler);
        this.api.offError(errorHandler);
        if (subscriptionId !== null) {
          try {
            this.api.unsubscribe(subscriptionId);
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
          reject(new OrderServiceError(errorMessage));
          return;
        }

        if (message.code === MESSAGE_CODE.A) {
          const parsed = schema.safeParse(message.payload);
          if (!parsed.success) {
            resolved = true;
            cleanup();
            logger.api.error(
              { error: parsed.error },
              `${topic} response validation failed`,
            );
            reject(
              new OrderServiceError(
                `Invalid ${topic} response: ${String(parsed.error)}`,
              ),
            );
            return;
          }

          resolved = true;
          cleanup();
          logger.api.info(`${topic} subscription successful`);
          resolve(parsed.data);
        }
      };

      const errorHandler = (error: Error | WebSocketMessage): void => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        logger.api.error({ error }, `${topic} subscription error`);
        reject(
          error instanceof Error
            ? error
            : new OrderServiceError('WebSocket error'),
        );
      };

      this.api.onMessage(messageHandler);
      this.api.onError(errorHandler);

      try {
        subscriptionId = this.api.subscribe({
          topic,
          payload,
        });

        timeoutId = setTimeout(() => {
          // Note: This callback only runs if cleanup() hasn't been called,
          // because cleanup() calls clearTimeout(). So 'resolved' will always
          // be false when this callback executes.
          resolved = true;
          cleanup();
          logger.api.warn(`${topic} request timed out`);
          reject(new OrderServiceError(`${topic} request timed out`));
        }, this.timeoutMs);
      } catch (error) {
        cleanup();
        throw error;
      }
    });
  }

  private ensureAuthenticated(): void {
    const authStatus = this.api.getAuthStatus();
    if (authStatus !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }

  private buildOrderPayload(
    request: PlaceOrderRequest,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      isin: request.isin,
      type: request.orderType,
      mode: request.mode,
      size: request.size,
    };

    if (request.expiry !== undefined) {
      payload.expiry = request.expiry;
    }

    if (request.exchange !== undefined) {
      payload.exchangeId = request.exchange;
    }

    if (request.sellFractions !== undefined) {
      payload.sellFractions = request.sellFractions;
    }

    if (request.warningsShown !== undefined) {
      payload.warningsShown = request.warningsShown;
    }

    if (request.limitPrice !== undefined) {
      payload.limit = request.limitPrice;
    }

    if (request.stopPrice !== undefined) {
      payload.stop = request.stopPrice;
    }

    if (request.expiryDate !== undefined) {
      payload.expiryDate = request.expiryDate;
    }

    return payload;
  }
}
