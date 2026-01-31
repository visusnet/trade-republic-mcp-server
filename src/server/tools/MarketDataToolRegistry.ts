/**
 * Market Data Tool Registry
 *
 * Registers MCP tools for market data operations: prices, price history,
 * order book, search, asset info, market status, and wait for market.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { MarketDataService } from '../services/MarketDataService';
import {
  GetPriceRequestSchema,
  GetPriceHistoryRequestSchema,
  GetOrderBookRequestSchema,
  SearchAssetsRequestSchema,
  GetAssetInfoRequestSchema,
  GetMarketStatusRequestSchema,
  WaitForMarketRequestSchema,
} from '../services/MarketDataService.request';
import { ToolRegistry } from './ToolRegistry';

export class MarketDataToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly marketDataService: MarketDataService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_price',
      {
        title: 'Get Price',
        description:
          'Get current bid/ask/last price for an instrument. Returns spread and spread percentage. Requires authentication.',
        inputSchema: GetPriceRequestSchema.shape,
      },
      this.marketDataService.getPrice.bind(this.marketDataService),
    );

    this.registerTool(
      'get_price_history',
      {
        title: 'Get Price History',
        description:
          'Get historical OHLCV price data (candles) for an instrument. Supports various time ranges (1d, 5d, 1m, 3m, 6m, 1y, 5y, max). Requires authentication.',
        inputSchema: GetPriceHistoryRequestSchema.shape,
      },
      this.marketDataService.getPriceHistory.bind(this.marketDataService),
    );

    this.registerTool(
      'get_order_book',
      {
        title: 'Get Order Book',
        description:
          'Get order book (bid/ask) for an instrument. Returns top-of-book data with spread and mid price. Requires authentication.',
        inputSchema: GetOrderBookRequestSchema.shape,
      },
      this.marketDataService.getOrderBook.bind(this.marketDataService),
    );

    this.registerTool(
      'search_assets',
      {
        title: 'Search Assets',
        description:
          'Search for tradable assets by name, symbol, or ISIN. Returns matching instruments with ISIN, name, and type. Requires authentication.',
        inputSchema: SearchAssetsRequestSchema.shape,
      },
      this.marketDataService.searchAssets.bind(this.marketDataService),
    );

    this.registerTool(
      'get_asset_info',
      {
        title: 'Get Asset Info',
        description:
          'Get detailed information about an instrument including name, symbol, type, company details, and available exchanges. Requires authentication.',
        inputSchema: GetAssetInfoRequestSchema.shape,
      },
      this.marketDataService.getAssetInfo.bind(this.marketDataService),
    );

    this.registerTool(
      'get_market_status',
      {
        title: 'Get Market Status',
        description:
          'Check if the market is open for an instrument. Returns status (open/closed/pre-market/post-market) and bid/ask availability. Requires authentication.',
        inputSchema: GetMarketStatusRequestSchema.shape,
      },
      this.marketDataService.getMarketStatus.bind(this.marketDataService),
    );

    this.registerTool(
      'wait_for_market',
      {
        title: 'Wait for Market',
        description:
          'Wait for the market to open for an instrument. Polls market status until open or timeout. Useful for scheduling trades at market open. Requires authentication.',
        inputSchema: WaitForMarketRequestSchema.shape,
      },
      this.marketDataService.waitForMarket.bind(this.marketDataService),
    );
  }
}
