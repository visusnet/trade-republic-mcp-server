/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { ExecutionToolRegistry } from './ExecutionToolRegistry';
import type { OrderService } from '../services/OrderService';
import type { ToolResult } from './ToolRegistry';

/**
 * Creates a mock OrderService for testing.
 */
function createMockOrderService(): jest.Mocked<OrderService> {
  return {
    placeOrder: jest.fn(),
    getOrders: jest.fn(),
    modifyOrder: jest.fn(),
    cancelOrder: jest.fn(),
  } as unknown as jest.Mocked<OrderService>;
}

/**
 * Creates a mock McpServer for testing.
 */
function createMockServer(): { registerTool: jest.Mock } {
  return {
    registerTool: jest.fn(),
  };
}

describe('ExecutionToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let mockOrderService: jest.Mocked<OrderService>;
  let registry: ExecutionToolRegistry;

  beforeEach(() => {
    mockServer = createMockServer();
    mockOrderService = createMockOrderService();
    registry = new ExecutionToolRegistry(
      mockServer as unknown as McpServer,
      mockOrderService,
    );
  });

  describe('register', () => {
    it('should register all 4 tools', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(4);
    });

    it('should register place_order tool with WARNING', () => {
      registry.register();

      const call = mockServer.registerTool.mock.calls.find(
        (c) => c[0] === 'place_order',
      );

      expect(call).toBeDefined();
      const config = call![1] as { title: string; description: string };
      expect(config.title).toBe('Place Order');
      expect(config.description).toContain('WARNING');
      expect(config.description).toContain('live');
      expect(config.description).toContain('REAL');
    });

    it('should register get_orders tool', () => {
      registry.register();

      const call = mockServer.registerTool.mock.calls.find(
        (c) => c[0] === 'get_orders',
      );

      expect(call).toBeDefined();
      const config = call![1] as { title: string; description: string };
      expect(config.title).toBe('Get Orders');
      expect(config.description).toContain('orders');
    });

    it('should register modify_order tool', () => {
      registry.register();

      const call = mockServer.registerTool.mock.calls.find(
        (c) => c[0] === 'modify_order',
      );

      expect(call).toBeDefined();
      const config = call![1] as { title: string; description: string };
      expect(config.title).toBe('Modify Order');
      expect(config.description).toContain('Modify');
    });

    it('should register cancel_order tool', () => {
      registry.register();

      const call = mockServer.registerTool.mock.calls.find(
        (c) => c[0] === 'cancel_order',
      );

      expect(call).toBeDefined();
      const config = call![1] as { title: string; description: string };
      expect(config.title).toBe('Cancel Order');
      expect(config.description).toContain('cancel');
    });
  });

  describe('place_order handler', () => {
    it('should call orderService.placeOrder', async () => {
      mockOrderService.placeOrder.mockResolvedValue({
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy' as const,
        mode: 'market' as const,
        size: 10,
        timestamp: '2026-02-01T12:00:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'place_order',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(mockOrderService.placeOrder).toHaveBeenCalled();
    });

    it('should return formatted success result', async () => {
      const orderResponse = {
        orderId: 'order-123',
        status: 'pending',
        isin: 'DE0007164600',
        exchange: 'LSX',
        orderType: 'buy' as const,
        mode: 'market' as const,
        size: 10,
        timestamp: '2026-02-01T12:00:00Z',
      };
      mockOrderService.placeOrder.mockResolvedValue(orderResponse);

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'place_order',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(orderResponse);
    });

    it('should return error result on failure', async () => {
      mockOrderService.placeOrder.mockRejectedValue(
        new Error('Insufficient funds'),
      );

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'place_order',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({
        isin: 'DE0007164600',
        orderType: 'buy',
        mode: 'market',
        size: 10,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Insufficient funds');
    });
  });

  describe('get_orders handler', () => {
    it('should call orderService.getOrders', async () => {
      mockOrderService.getOrders.mockResolvedValue({
        orders: [],
        totalCount: 0,
        timestamp: '2026-02-01T12:00:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_orders',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({});

      expect(mockOrderService.getOrders).toHaveBeenCalled();
    });
  });

  describe('cancel_order handler', () => {
    it('should call orderService.cancelOrder', async () => {
      mockOrderService.cancelOrder.mockResolvedValue({
        orderId: 'order-123',
        status: 'cancelled',
        cancelled: true,
        timestamp: '2026-02-01T12:00:00Z',
      });

      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'cancel_order',
      )![2] as (input: unknown) => Promise<ToolResult>;

      await handler({ orderId: 'order-123' });

      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith({
        orderId: 'order-123',
      });
    });
  });
});
