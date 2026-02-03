/**
 * Execution Tool Registry
 *
 * Registers MCP tools for order execution and management operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { OrderService } from '../services/OrderService';
import {
  PlaceOrderRequestSchema,
  GetOrdersRequestSchema,
  ModifyOrderRequestSchema,
  CancelOrderRequestSchema,
} from '../services/OrderService.request';
import { ToolRegistry } from './ToolRegistry';

export class ExecutionToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly orderService: OrderService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'place_order',
      {
        title: 'Place Order',
        description:
          'WARNING: This creates REAL live trades with actual money. ' +
          'Place a market, limit, or stop-market order to buy or sell securities. ' +
          'Supports various expiry options (gfd, gtc, gtd). ' +
          'Requires authentication. ' +
          'Always verify order details before execution.',
        inputSchema: PlaceOrderRequestSchema.shape,
      },
      this.orderService.placeOrder.bind(this.orderService),
    );

    this.registerTool(
      'get_orders',
      {
        title: 'Get Orders',
        description:
          'Get current and historical orders. ' +
          'Can filter to include executed and cancelled orders. ' +
          'Returns order details including status, type, size, and prices. ' +
          'Requires authentication.',
        inputSchema: GetOrdersRequestSchema.shape,
      },
      this.orderService.getOrders.bind(this.orderService),
    );

    this.registerTool(
      'modify_order',
      {
        title: 'Modify Order',
        description:
          'Modify a pending order (price, expiry). ' +
          'NOTE: This operation may not be supported by Trade Republic API. ' +
          'If not supported, cancel the order and place a new one. ' +
          'Requires authentication.',
        inputSchema: ModifyOrderRequestSchema.shape,
      },
      this.orderService.modifyOrder.bind(this.orderService),
    );

    this.registerTool(
      'cancel_order',
      {
        title: 'Cancel Order',
        description:
          'Cancel a pending order by order ID. ' +
          'Only pending orders can be cancelled. ' +
          'Executed or already cancelled orders cannot be cancelled. ' +
          'Requires authentication.',
        inputSchema: CancelOrderRequestSchema.shape,
      },
      this.orderService.cancelOrder.bind(this.orderService),
    );
  }
}
