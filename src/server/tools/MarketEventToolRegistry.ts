/**
 * Market Event Tool Registry
 *
 * Registers MCP tools for market event monitoring: wait_for_market_event.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { MarketEventService } from '../services/MarketEventService';
import { WaitForMarketEventRequestSchema } from '../services/MarketEventService.request';
import { ToolRegistry } from './ToolRegistry';

export class MarketEventToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly marketEventService: MarketEventService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'wait_for_market_event',
      {
        title: 'Wait for Market Event',
        description:
          'Wait for market conditions to be met on one or more instruments. ' +
          'Monitors ticker data in real-time and triggers when specified conditions match. ' +
          'Supports multiple ISINs with multiple conditions using AND/OR logic. ' +
          'Useful for event-driven trading strategies. Requires authentication.',
        inputSchema: WaitForMarketEventRequestSchema.shape,
      },
      this.marketEventService.waitForMarketEvent.bind(this.marketEventService),
    );
  }
}
