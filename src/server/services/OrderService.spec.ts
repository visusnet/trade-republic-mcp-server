import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';
import { mockTradeRepublicApiService } from '@test/serviceMocks';

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
  TradeRepublicError,
} from './TradeRepublicApiService.types';
import {
  PlaceOrderResponseSchema,
  GetOrdersResponseSchema,
  CancelOrderResponseSchema,
} from './OrderService.response';

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

    it('should accept limit order without limitPrice in schema (validation moved to service)', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'limit',
        size: 5,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      // Schema parsing succeeds - validation moved to service
      expect(result.success).toBe(true);
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

    it('should accept stop-market order without stopPrice in schema (validation moved to service)', async () => {
      const { PlaceOrderRequestSchema } =
        await import('./OrderService.request');

      const request = {
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'stopMarket',
        size: 5,
      };

      const result = PlaceOrderRequestSchema.safeParse(request);

      // Schema parsing succeeds - validation moved to service
      expect(result.success).toBe(true);
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

    it('should accept gtd expiry without expiryDate in schema (validation moved to service)', async () => {
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

      // Schema parsing succeeds - validation moved to service
      expect(result.success).toBe(true);
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
  let service: OrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
      AuthStatus.AUTHENTICATED,
    );
    mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({} as never);
    service = new OrderService(
      mockTradeRepublicApiService as unknown as TradeRepublicApiService,
    );
  });

  describe('placeOrder', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

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

    it('should throw OrderValidationError for limit order without limitPrice', async () => {
      await expect(
        service.placeOrder({
          isin: 'US0378331005',
          orderType: 'buy',
          mode: 'limit',
          size: 5,
        }),
      ).rejects.toThrow(OrderValidationError);
      await expect(
        service.placeOrder({
          isin: 'US0378331005',
          orderType: 'buy',
          mode: 'limit',
          size: 5,
        }),
      ).rejects.toThrow('limitPrice is required for limit orders');
    });

    it('should throw OrderValidationError for stop-market order without stopPrice', async () => {
      await expect(
        service.placeOrder({
          isin: 'US0378331005',
          orderType: 'buy',
          mode: 'stopMarket',
          size: 5,
        }),
      ).rejects.toThrow(OrderValidationError);
      await expect(
        service.placeOrder({
          isin: 'US0378331005',
          orderType: 'buy',
          mode: 'stopMarket',
          size: 5,
        }),
      ).rejects.toThrow('stopPrice is required for stop-market orders');
    });

    it('should throw OrderValidationError for gtd expiry without expiryDate', async () => {
      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
          expiry: 'gtd',
        }),
      ).rejects.toThrow(OrderValidationError);
      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
          expiry: 'gtd',
        }),
      ).rejects.toThrow('expiryDate is required for gtd expiry');
    });

    it('should call subscribeAndWait with correct parameters for market order', async () => {
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
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        orderResponse,
      );

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          isin: 'DE0007164600',
          type: 'buy',
          mode: 'market',
          size: 10,
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass limit price for limit orders', async () => {
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
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        orderResponse,
      );

      await service.placeOrder({
        isin: 'US0378331005',
        orderType: 'sell',
        mode: 'limit',
        size: 5,
        limitPrice: 150.5,
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          isin: 'US0378331005',
          type: 'sell',
          mode: 'limit',
          size: 5,
          limit: 150.5,
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass stop price for stop-market orders', async () => {
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
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        orderResponse,
      );

      await service.placeOrder({
        isin: 'US0378331005',
        orderType: 'buy',
        mode: 'stopMarket',
        size: 5,
        stopPrice: 145.0,
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          isin: 'US0378331005',
          type: 'buy',
          mode: 'stopMarket',
          size: 5,
          stop: 145.0,
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass optional expiry field', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-126',
      });

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        expiry: 'gtc',
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          expiry: 'gtc',
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass optional exchange field as exchangeId', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-127',
      });

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        exchange: 'XETRA',
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          exchangeId: 'XETRA',
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass optional sellFractions field', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-128',
      });

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'sell',
        mode: 'market',
        size: 10,
        sellFractions: true,
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          sellFractions: true,
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass optional warningsShown field', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-129',
      });

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
        warningsShown: ['RISK_WARNING'],
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          warningsShown: ['RISK_WARNING'],
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should pass optional expiryDate field', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-130',
      });

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'limit',
        size: 10,
        limitPrice: 100.0,
        expiry: 'gtd',
        expiryDate: '2026-12-31',
      });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'simpleCreateOrder',
        expect.objectContaining({
          expiryDate: '2026-12-31',
        }),
        PlaceOrderResponseSchema,
      );
    });

    it('should return order response from subscribeAndWait', async () => {
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
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        orderResponse,
      );

      const result = await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(result.orderId).toBe('order-123');
      expect(result.status).toBe('pending');
      expect(result.orderType).toBe('buy');
      expect(result.mode).toBe('market');
      expect(result.size).toBe(10);
    });

    it('should propagate errors from subscribeAndWait', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockRejectedValue(
        new TradeRepublicError('simpleCreateOrder request timed out'),
      );

      await expect(
        service.placeOrder({
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        }),
      ).rejects.toThrow('simpleCreateOrder request timed out');
    });

    it('should log the order request', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-123',
        status: 'pending',
      });

      await service.placeOrder({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(logger.api.info).toHaveBeenCalledWith(
        expect.objectContaining({ request: expect.any(Object) }),
        'Placing order',
      );
    });
  });

  describe('getOrders', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(service.getOrders()).rejects.toThrow(TradeRepublicError);
      await expect(service.getOrders()).rejects.toThrow('Not authenticated');
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const ordersResponse = {
        orders: [],
        totalCount: 0,
        timestamp: '2026-02-01T12:00:00Z',
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        ordersResponse,
      );

      await service.getOrders();

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'orders',
        {},
        GetOrdersResponseSchema,
      );
    });

    it('should return orders from subscribeAndWait', async () => {
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
        ],
        totalCount: 1,
        timestamp: '2026-02-01T12:00:00Z',
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        ordersResponse,
      );

      const result = await service.getOrders();

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderId).toBe('order-1');
      expect(result.totalCount).toBe(1);
    });

    it('should propagate errors from subscribeAndWait', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockRejectedValue(
        new TradeRepublicError('orders request timed out'),
      );

      await expect(service.getOrders()).rejects.toThrow(
        'orders request timed out',
      );
    });

    it('should log the request', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orders: [],
        totalCount: 0,
      });

      await service.getOrders();

      expect(logger.api.info).toHaveBeenCalledWith('Requesting orders');
    });
  });

  describe('cancelOrder', () => {
    it('should throw if not authenticated', async () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

      await expect(
        service.cancelOrder({ orderId: 'order-123' }),
      ).rejects.toThrow(TradeRepublicError);
      await expect(
        service.cancelOrder({ orderId: 'order-123' }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const cancelResponse = {
        orderId: 'order-123',
        status: 'cancelled',
        cancelled: true,
        timestamp: '2026-02-01T12:00:00Z',
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        cancelResponse,
      );

      await service.cancelOrder({ orderId: 'order-123' });

      expect(mockTradeRepublicApiService.subscribeAndWait).toHaveBeenCalledWith(
        'cancelOrder',
        { orderId: 'order-123' },
        CancelOrderResponseSchema,
      );
    });

    it('should return cancel response from subscribeAndWait', async () => {
      const cancelResponse = {
        orderId: 'order-123',
        status: 'cancelled',
        cancelled: true,
        timestamp: '2026-02-01T12:00:00Z',
      };
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue(
        cancelResponse,
      );

      const result = await service.cancelOrder({ orderId: 'order-123' });

      expect(result.orderId).toBe('order-123');
      expect(result.cancelled).toBe(true);
    });

    it('should propagate errors from subscribeAndWait', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockRejectedValue(
        new TradeRepublicError('Order already executed'),
      );

      await expect(
        service.cancelOrder({ orderId: 'order-123' }),
      ).rejects.toThrow('Order already executed');
    });

    it('should log the cancel request', async () => {
      mockTradeRepublicApiService.subscribeAndWait.mockResolvedValue({
        orderId: 'order-123',
        cancelled: true,
      });

      await service.cancelOrder({ orderId: 'order-123' });

      expect(logger.api.info).toHaveBeenCalledWith(
        { orderId: 'order-123' },
        'Cancelling order',
      );
    });
  });

  describe('modifyOrder', () => {
    it('should throw if not authenticated', () => {
      mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
        AuthStatus.UNAUTHENTICATED,
      );

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
