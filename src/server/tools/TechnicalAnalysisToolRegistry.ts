/**
 * Technical Analysis Tool Registry
 *
 * Registers MCP tools for technical analysis operations:
 * get_indicators and get_detailed_analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { TechnicalAnalysisService } from '../services/TechnicalAnalysisService';
import {
  GetIndicatorsRequestSchema,
  GetDetailedAnalysisRequestSchema,
} from '../services/TechnicalAnalysisService.request';
import { ToolRegistry } from './ToolRegistry';

export class TechnicalAnalysisToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly technicalAnalysisService: TechnicalAnalysisService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_indicators',
      {
        title: 'Get Indicators',
        description:
          'Calculate specific technical indicators (RSI, MACD, Bollinger, SMA, EMA, ADX, Stochastic, ATR, OBV, VWAP) for an instrument. Returns indicator values with optional period configuration. Requires authentication.',
        inputSchema: GetIndicatorsRequestSchema.shape,
      },
      this.technicalAnalysisService.getIndicators.bind(
        this.technicalAnalysisService,
      ),
    );

    this.registerTool(
      'get_detailed_analysis',
      {
        title: 'Get Detailed Analysis',
        description:
          'Get comprehensive technical analysis with trading signals for an instrument. Calculates all core indicators, generates buy/sell/hold signals, and provides trend analysis with overall recommendation. Requires authentication.',
        inputSchema: GetDetailedAnalysisRequestSchema.shape,
      },
      this.technicalAnalysisService.getDetailedAnalysis.bind(
        this.technicalAnalysisService,
      ),
    );
  }
}
