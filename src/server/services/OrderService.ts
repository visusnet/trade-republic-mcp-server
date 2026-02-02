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
  TradeRepublicError,
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

    return this.api.subscribeAndWait(
      'simpleCreateOrder',
      payload,
      PlaceOrderResponseSchema,
      this.timeoutMs,
    );
  }

  public async getOrders(
    _request?: GetOrdersRequest,
  ): Promise<GetOrdersResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting orders');
    return this.api.subscribeAndWait(
      'orders',
      {},
      GetOrdersResponseSchema,
      this.timeoutMs,
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
    return this.api.subscribeAndWait(
      'cancelOrder',
      { orderId: request.orderId },
      CancelOrderResponseSchema,
      this.timeoutMs,
    );
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
