/**
 * Order Service
 *
 * Provides methods for placing and managing orders
 * via Trade Republic API using WebSocket subscriptions.
 */

import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
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
import { OrderServiceError, OrderValidationError } from './OrderService.types';

export class OrderService {
  constructor(private readonly api: TradeRepublicApiService) {}

  public async placeOrder(
    request: PlaceOrderRequest,
  ): Promise<PlaceOrderResponse> {
    this.validatePlaceOrderRequest(request);
    logger.api.info({ request }, 'Placing order');

    const payload = this.buildOrderPayload(request);

    return this.api.subscribeAndWait(
      'simpleCreateOrder',
      payload,
      PlaceOrderResponseSchema,
    );
  }

  public async getOrders(
    _request?: GetOrdersRequest,
  ): Promise<GetOrdersResponse> {
    logger.api.info('Requesting orders');
    return this.api.subscribeAndWait('orders', {}, GetOrdersResponseSchema);
  }

  public modifyOrder(
    _request: ModifyOrderRequest,
  ): Promise<ModifyOrderResponse> {
    throw new OrderServiceError(
      'Order modification is not supported by Trade Republic API. Please cancel the order and place a new one.',
      'NOT_SUPPORTED',
    );
  }

  public async cancelOrder(
    request: CancelOrderRequest,
  ): Promise<CancelOrderResponse> {
    logger.api.info({ orderId: request.orderId }, 'Cancelling order');
    return this.api.subscribeAndWait(
      'cancelOrder',
      { orderId: request.orderId },
      CancelOrderResponseSchema,
    );
  }

  private validatePlaceOrderRequest(request: PlaceOrderRequest): void {
    if (request.mode === 'limit' && request.limitPrice === undefined) {
      throw new OrderValidationError(
        'limitPrice is required for limit orders',
        'MISSING_LIMIT_PRICE',
      );
    }

    if (request.mode === 'stopMarket' && request.stopPrice === undefined) {
      throw new OrderValidationError(
        'stopPrice is required for stop-market orders',
        'MISSING_STOP_PRICE',
      );
    }

    if (request.expiry === 'gtd' && request.expiryDate === undefined) {
      throw new OrderValidationError(
        'expiryDate is required for gtd expiry',
        'MISSING_EXPIRY_DATE',
      );
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
