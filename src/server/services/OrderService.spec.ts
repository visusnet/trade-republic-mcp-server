/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import {
  OrderServiceError,
  OrderValidationError,
  InsufficientFundsError,
  OrderNotFoundError,
  OrderNotModifiableError,
} from './OrderService.types';
import { OrderService } from './OrderService';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';

/**
 * Creates a mock TradeRepublicApiService for testing.
 */
function createMockApiService(): jest.Mocked<TradeRepublicApiService> {
  return {
    getAuthStatus: jest
      .fn<() => AuthStatus>()
      .mockReturnValue(AuthStatus.AUTHENTICATED),
    subscribe: jest
      .fn<(input: { topic: string; payload?: object }) => number>()
      .mockReturnValue(1),
    unsubscribe: jest.fn<(id: number) => void>(),
    onMessage:
      jest.fn<(handler: (message: WebSocketMessage) => void) => void>(),
    offMessage:
      jest.fn<(handler: (message: WebSocketMessage) => void) => void>(),
    onError:
      jest.fn<(handler: (error: Error | WebSocketMessage) => void) => void>(),
    offError:
      jest.fn<(handler: (error: Error | WebSocketMessage) => void) => void>(),
  } as unknown as jest.Mocked<TradeRepublicApiService>;
}

describe('OrderService.types', () => {
  describe('Error Classes', () => {
    it('should create OrderServiceError with correct name and code', () => {
      const error = new OrderServiceError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('OrderServiceError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should create OrderValidationError extending OrderServiceError', () => {
      const error = new OrderValidationError('Validation failed', 'VAL_ERR');

      expect(error).toBeInstanceOf(OrderServiceError);
      expect(error.name).toBe('OrderValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VAL_ERR');
    });

    it('should create InsufficientFundsError extending OrderServiceError', () => {
      const error = new InsufficientFundsError(
        'Not enough funds',
        'INSUF_FUNDS',
      );

      expect(error).toBeInstanceOf(OrderServiceError);
      expect(error.name).toBe('InsufficientFundsError');
      expect(error.message).toBe('Not enough funds');
      expect(error.code).toBe('INSUF_FUNDS');
    });

    it('should create OrderNotFoundError extending OrderServiceError', () => {
      const error = new OrderNotFoundError('Order not found', 'NOT_FOUND');

      expect(error).toBeInstanceOf(OrderServiceError);
      expect(error.name).toBe('OrderNotFoundError');
      expect(error.message).toBe('Order not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create OrderNotModifiableError extending OrderServiceError', () => {
      const error = new OrderNotModifiableError(
        'Cannot modify order',
        'NOT_MOD',
      );

      expect(error).toBeInstanceOf(OrderServiceError);
      expect(error.name).toBe('OrderNotModifiableError');
      expect(error.message).toBe('Cannot modify order');
      expect(error.code).toBe('NOT_MOD');
    });
  });
});

describe('OrderService.request', () => {
  describe('PlaceOrderRequestSchema', () => {
    it('should validate a market order', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
          expiry: 'gfd',
          exchange: 'LSX',
        },
      });
    });

    it('should validate a limit order with limitPrice', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'US0378331005',
        orderType: 'sell',
        mode: 'limit',
        size: 5,
        limitPrice: 150.5,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          mode: 'limit',
          limitPrice: 150.5,
        },
      });
    });

    it('should reject limit order without limitPrice', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'limit',
        size: 5,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      // Type assertion needed for conditional Zod parsing results
      const error = (
        result as {
          success: false;
          error: { issues: Array<{ message: string }> };
        }
      ).error;
      expect(error.issues[0].message).toContain('limitPrice');
    });

    it('should validate a stop-market order with stopPrice', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'stopMarket',
        size: 5,
        stopPrice: 145.0,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          mode: 'stopMarket',
          stopPrice: 145.0,
        },
      });
    });

    it('should reject stop-market order without stopPrice', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'stopMarket',
        size: 5,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      // Type assertion needed for conditional Zod parsing results
      const error = (
        result as {
          success: false;
          error: { issues: Array<{ message: string }> };
        }
      ).error;
      expect(error.issues[0].message).toContain('stopPrice');
    });

    it('should validate gtd expiry with expiryDate', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'limit',
        size: 10,
        limitPrice: 100,
        expiry: 'gtd',
        expiryDate: '2026-12-31',
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          expiry: 'gtd',
          expiryDate: '2026-12-31',
        },
      });
    });

    it('should reject gtd expiry without expiryDate', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        expiry: 'gtd',
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      // Type assertion needed for conditional Zod parsing results
      const error = (
        result as {
          success: false;
          error: { issues: Array<{ message: string }> };
        }
      ).error;
      expect(error.issues[0].message).toContain('expiryDate');
    });

    it('should reject invalid ISIN length', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'INVALID',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should reject negative size', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: -5,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });
  });

  describe('GetOrdersRequestSchema', () => {
    it('should validate empty request with defaults', async () => {
      const { GetOrdersRequestSchema } = await import('./OrderService.request');

      const result = GetOrdersRequestSchema.safeParse({});

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          includeExecuted: false,
          includeCancelled: false,
        },
      });
    });

    it('should validate request with filters', async () => {
      const { GetOrdersRequestSchema } = await import('./OrderService.request');

      const request = {
        includeExecuted: true,
        includeCancelled: true,
      };

      const result = GetOrdersRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          includeExecuted: true,
          includeCancelled: true,
        },
      });
    });
  });

  describe('CancelOrderRequestSchema', () => {
    it('should validate cancel request', async () => {
      const { CancelOrderRequestSchema } =
        await import('./OrderService.request');

      const request = { orderId: 'order-123' };

      const result = CancelOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          orderId: 'order-123',
        },
      });
    });

    it('should reject cancel request without orderId', async () => {
      const { CancelOrderRequestSchema } =
        await import('./OrderService.request');

      const result = CancelOrderRequestSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('ModifyOrderRequestSchema', () => {
    it('should validate modify request', async () => {
      const { ModifyOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        orderId: 'order-123',
        limitPrice: 150.0,
      };

      const result = ModifyOrderRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          orderId: 'order-123',
          limitPrice: 150.0,
        },
      });
    });

    it('should reject modify request without orderId', async () => {
      const { ModifyOrderRequestSchema } =
        await import('./OrderService.request');

      const result = ModifyOrderRequestSchema.safeParse({
        limitPrice: 150.0,
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('OrderService.response', () => {
  describe('PlaceOrderResponseSchema', () => {
    it('should parse successful place order response', async () => {
      const { PlaceOrderResponseSchema } =
        await import('./OrderService.response');

      const apiResponse = {
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        estimatedPrice: 100.5,
        estimatedCost: 1005.0,
        estimatedFees: 1.0,
        warnings: [],
        timestamp: '2026-02-01T12:00:00Z',
      };

      const result = PlaceOrderResponseSchema.safeParse(apiResponse);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          orderId: 'order-123',
          status: 'pending',
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        },
      });
    });
  });

  describe('GetOrdersResponseSchema', () => {
    it('should parse get orders response', async () => {
      const { GetOrdersResponseSchema } =
        await import('./OrderService.response');

      const apiResponse = {
        orders: [
          {
            orderId: 'order-1',
            status: 'pending',
            isin: 'DE0007164600',
            exchange: 'LSX',
            orderType: 'buy',
            mode: 'limit',
            size: 10,
            limitPrice: 100.0,
            createdAt: '2026-02-01T10:00:00Z',
          },
        ],
        totalCount: 1,
        timestamp: '2026-02-01T12:00:00Z',
      };

      const result = GetOrdersResponseSchema.safeParse(apiResponse);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          totalCount: 1,
        }),
      });
      // Type assertion needed for conditional Zod parsing results
      const data = (
        result as {
          success: true;
          data: { orders: Array<{ orderId: string }> };
        }
      ).data;
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].orderId).toBe('order-1');
    });
  });

  describe('CancelOrderResponseSchema', () => {
    it('should parse cancel order response', async () => {
      const { CancelOrderResponseSchema } =
        await import('./OrderService.response');

      const apiResponse = {
        orderId: 'order-123',
        status: 'cancelled',
        cancelled: true,
        timestamp: '2026-02-01T12:00:00Z',
      };

      const result = CancelOrderResponseSchema.safeParse(apiResponse);

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        success: true,
        data: {
          orderId: 'order-123',
          cancelled: true,
        },
      });
    });
  });
});

describe('OrderService', () => {
  let mockApi: jest.Mocked<TradeRepublicApiService>;
  let service: OrderService;
  const SHORT_TIMEOUT = 100;

  beforeEach(() => {
    mockApi = createMockApiService();
    service = new OrderService(mockApi, SHORT_TIMEOUT);
  });

  describe('placeOrder', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to simpleCreateOrder topic with correct payload', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'simpleCreateOrder',
        payload: expect.objectContaining({
          isin: 'DE0007164600',
          type: 'buy',
          mode: 'market',
          size: 10,
        }),
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow(
        'simpleCreateOrder request timed out',
      );
    });

    it('should place a market buy order successfully', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      const orderResponse = {
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        estimatedPrice: 100.5,
        estimatedCost: 1005.0,
        estimatedFees: 1.0,
        warnings: [],
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      const result = await promise;

      expect(result.orderId).toBe('order-123');
      expect(result.status).toBe('pending');
      expect(result.orderType).toBe('buy');
      expect(result.mode).toBe('market');
      expect(result.size).toBe(10);
    });

    it('should place a limit order with limitPrice', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'US0378331005',
        orderType: 'sell',
        mode: 'limit',
        size: 5,
        limitPrice: 150.5,
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'simpleCreateOrder',
        payload: expect.objectContaining({
          isin: 'US0378331005',
          type: 'sell',
          mode: 'limit',
          size: 5,
          limit: 150.5,
        }),
      });

      const orderResponse = {
        orderId: 'order-124',
        status: 'pending',
        isin: 'US0378331005',
        exchange: 'LSX',
        orderType: 'sell',
        mode: 'limit',
        size: 5,
        limitPrice: 150.5,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      const result = await promise;

      expect(result.orderId).toBe('order-124');
      expect(result.mode).toBe('limit');
      expect(result.limitPrice).toBe(150.5);
    });

    it('should place a stop-market order with stopPrice', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'stopMarket',
        size: 5,
        stopPrice: 145.0,
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'simpleCreateOrder',
        payload: expect.objectContaining({
          isin: 'US0378331005',
          type: 'buy',
          mode: 'stopMarket',
          size: 5,
          stop: 145.0,
        }),
      });

      const orderResponse = {
        orderId: 'order-125',
        status: 'pending',
        isin: 'US0378331005',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'stopMarket',
        size: 5,
        stopPrice: 145.0,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      const result = await promise;

      expect(result.orderId).toBe('order-125');
      expect(result.mode).toBe('stopMarket');
      expect(result.stopPrice).toBe(145.0);
    });

    it('should handle gtd expiry with expiryDate', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'limit',
        size: 10,
        limitPrice: 100,
        expiry: 'gtd',
        expiryDate: '2026-12-31',
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'simpleCreateOrder',
        payload: expect.objectContaining({
          expiry: 'gtd',
          expiryDate: '2026-12-31',
        }),
      });

      const orderResponse = {
        orderId: 'order-126',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'limit',
        size: 10,
        limitPrice: 100,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      const result = await promise;

      expect(result.orderId).toBe('order-126');
    });

    it('should reject on API error (code E)', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Insufficient funds' },
      });

      await expect(promise).rejects.toThrow('Insufficient funds');
    });

    it('should use fallback error message when error payload has no message', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: {},
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('API error');
    });

    it('should handle timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        }),
      ).rejects.toThrow(OrderServiceError);
      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        }),
      ).rejects.toThrow('simpleCreateOrder request timed out');
    });

    it('should ignore messages with different subscription id', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      // Send message with wrong subscription id
      messageHandler!({
        id: 999,
        code: MESSAGE_CODE.A,
        payload: { orderId: 'wrong' },
      });

      // Send correct message
      const orderResponse = {
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      const result = await promise;

      expect(result.orderId).toBe('order-123');
    });

    it('should reject on validation error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      // Send invalid response (missing required fields)
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { invalid: 'data' },
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
    });

    it('should handle WebSocket error with Error object', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      errorHandler!(new Error('WebSocket connection failed'));

      await expect(promise).rejects.toThrow('WebSocket connection failed');
    });

    it('should handle WebSocket error with message object', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      errorHandler!({ id: subId, code: MESSAGE_CODE.E, payload: {} });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('WebSocket error');
    });

    it('should handle subscription throw error', async () => {
      mockApi.subscribe.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        }),
      ).rejects.toThrow('Subscription failed');
    });

    it('should include optional fields in payload when provided', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        exchange: 'XETRA',
        sellFractions: true,
        warningsShown: ['warning1', 'warning2'],
        expiry: 'gtc',
      });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'simpleCreateOrder',
        payload: expect.objectContaining({
          isin: 'DE0007164600',
          type: 'buy',
          mode: 'market',
          size: 10,
          exchangeId: 'XETRA',
          sellFractions: true,
          warningsShown: ['warning1', 'warning2'],
          expiry: 'gtc',
        }),
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
    });

    it('should ignore error handler call after resolution', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      const orderResponse = {
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        timestamp: '2026-02-01T12:00:00Z',
      };

      // First resolve with success
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      // Then try to trigger error handler (should be ignored)
      errorHandler!(new Error('This should be ignored'));

      const result = await promise;
      expect(result.orderId).toBe('order-123');
    });

    it('should clear timeout when resolved successfully', async () => {
      jest.useFakeTimers();
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      const orderResponse = {
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        timestamp: '2026-02-01T12:00:00Z',
      };

      // Resolve with success - this triggers cleanup() which clears the timeout
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: orderResponse,
      });

      const result = await promise;
      expect(result.orderId).toBe('order-123');

      // Advance timers - timeout should have been cleared so nothing happens
      jest.advanceTimersByTime(SHORT_TIMEOUT + 10);
      jest.runAllTimers();

      // Promise should still be resolved with original result
      expect(result.orderId).toBe('order-123');

      jest.useRealTimers();
    });
  });

  describe('getOrders', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.getOrders()).rejects.toThrow(TradeRepublicError);
      await expect(service.getOrders()).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to orders topic', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getOrders();

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'orders',
        payload: undefined,
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('orders request timed out');
    });

    it('should retrieve orders successfully', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrders();

      const ordersResponse = {
        orders: [
          {
            orderId: 'order-1',
            status: 'pending',
            isin: 'DE0007164600',
            exchange: 'LSX',
            orderType: 'buy',
            mode: 'limit',
            size: 10,
            limitPrice: 100.0,
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            orderId: 'order-2',
            status: 'executed',
            isin: 'US0378331005',
            exchange: 'LSX',
            orderType: 'sell',
            mode: 'market',
            size: 5,
            executedSize: 5,
            executedPrice: 150.5,
            createdAt: '2026-02-01T11:00:00Z',
          },
        ],
        totalCount: 2,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: ordersResponse,
      });

      const result = await promise;

      expect(result.orders).toHaveLength(2);
      expect(result.orders[0].orderId).toBe('order-1');
      expect(result.orders[0].status).toBe('pending');
      expect(result.orders[1].orderId).toBe('order-2');
      expect(result.orders[1].status).toBe('executed');
      expect(result.totalCount).toBe(2);
    });

    it('should handle empty orders list', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrders();

      const ordersResponse = {
        orders: [],
        totalCount: 0,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: ordersResponse,
      });

      const result = await promise;

      expect(result.orders).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should reject on API error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getOrders();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Failed to retrieve orders' },
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('Failed to retrieve orders');
    });
  });

  describe('cancelOrder', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(
        service.cancelOrder({ orderId: 'order-123' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.cancelOrder({ orderId: 'order-123' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to cancelOrder topic with orderId', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.cancelOrder({ orderId: 'order-123' });

      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'cancelOrder',
        payload: { orderId: 'order-123' },
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('cancelOrder request timed out');
    });

    it('should cancel order successfully', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.cancelOrder({ orderId: 'order-123' });

      const cancelResponse = {
        orderId: 'order-123',
        status: 'cancelled',
        cancelled: true,
        timestamp: '2026-02-01T12:00:00Z',
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: cancelResponse,
      });

      const result = await promise;

      expect(result.orderId).toBe('order-123');
      expect(result.status).toBe('cancelled');
      expect(result.cancelled).toBe(true);
    });

    it('should reject when order not found', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.cancelOrder({ orderId: 'nonexistent' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Order not found' },
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('Order not found');
    });

    it('should reject when order cannot be cancelled', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.cancelOrder({ orderId: 'order-123' });

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Order already executed' },
      });

      await expect(promise).rejects.toThrow(OrderServiceError);
      await expect(promise).rejects.toThrow('Order already executed');
    });
  });

  describe('modifyOrder', () => {
    it('should throw if not authenticated', () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      expect(() =>
        service.modifyOrder({
          orderId: 'order-123',
          limitPrice: 150.0,
        }),
      ).toThrow(TradeRepublicError);
      expect(() =>
        service.modifyOrder({
          orderId: 'order-123',
          limitPrice: 150.0,
        }),
      ).toThrow('Not authenticated');
    });

    it('should throw NOT_SUPPORTED error', () => {
      expect(() =>
        service.modifyOrder({
          orderId: 'order-123',
          limitPrice: 150.0,
        }),
      ).toThrow(OrderServiceError);
      expect(() =>
        service.modifyOrder({
          orderId: 'order-123',
          limitPrice: 150.0,
        }),
      ).toThrow('not supported');
    });

    it('should include helpful error message', () => {
      expect(() =>
        service.modifyOrder({
          orderId: 'order-123',
          limitPrice: 150.0,
        }),
      ).toThrow(
        expect.objectContaining({
          name: 'OrderServiceError',
          code: 'NOT_SUPPORTED',
          message: expect.stringContaining('cancel'),
        }),
      );

      expect(() =>
        service.modifyOrder({
          orderId: 'order-123',
          limitPrice: 150.0,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('place a new one'),
        }),
      );
    });
  });
});
