/**
 * Portfolio Tool Registry
 *
 * Registers MCP tools for portfolio and cash balance operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { PortfolioService } from '../services/PortfolioService';
import {
  GetPortfolioRequestSchema,
  GetCashBalanceRequestSchema,
} from '../services/PortfolioService.request';
import { ToolRegistry } from './ToolRegistry';

export class PortfolioToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly portfolioService: PortfolioService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_portfolio',
      {
        title: 'Get Portfolio',
        description:
          'Get current portfolio with all positions including instrument IDs, quantities, values, and profit/loss. Requires authentication.',
        inputSchema: GetPortfolioRequestSchema.shape,
      },
      this.portfolioService.getPortfolio.bind(this.portfolioService),
    );

    this.registerTool(
      'get_cash_balance',
      {
        title: 'Get Cash Balance',
        description:
          'Get current available cash balance in the account. Returns amount and currency. Requires authentication.',
        inputSchema: GetCashBalanceRequestSchema.shape,
      },
      this.portfolioService.getCashBalance.bind(this.portfolioService),
    );
  }
}
