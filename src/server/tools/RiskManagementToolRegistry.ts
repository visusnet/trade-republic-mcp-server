/**
 * Risk Management Tool Registry
 *
 * Registers MCP tools for risk management operations:
 * calculate_position_size and get_risk_metrics.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { RiskService } from '../services/RiskService';
import {
  CalculatePositionSizeRequestSchema,
  GetRiskMetricsRequestSchema,
} from '../services/RiskService.types';
import { ToolRegistry } from './ToolRegistry';

export class RiskManagementToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly riskService: RiskService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'calculate_position_size',
      {
        title: 'Calculate Position Size',
        description:
          'Calculate optimal position size using Kelly Criterion. Takes account balance, historical win rate, average win/loss amounts, and returns recommended position size with safety caps and warnings. Supports fractional Kelly (quarter/half/full) for risk management.',
        inputSchema: CalculatePositionSizeRequestSchema.shape,
      },
      this.riskService.calculatePositionSize.bind(this.riskService),
    );

    this.registerTool(
      'get_risk_metrics',
      {
        title: 'Get Risk Metrics',
        description:
          'Calculate comprehensive risk metrics from historical price data. Returns volatility (daily and annualized), Value at Risk (parametric and historical), maximum drawdown, Sharpe ratio, and return statistics. Supports daily, weekly, and monthly timeframes.',
        inputSchema: GetRiskMetricsRequestSchema.shape,
      },
      this.riskService.getRiskMetrics.bind(this.riskService),
    );
  }
}
