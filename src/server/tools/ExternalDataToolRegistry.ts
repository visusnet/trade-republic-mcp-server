/**
 * External Data Tool Registry
 *
 * Registers MCP tools for external data operations:
 * get_news, get_sentiment, and get_fundamentals.
 * These tools use free data sources and do not require authentication.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { NewsService } from '../services/NewsService';
import type { SentimentService } from '../services/SentimentService';
import type { FundamentalsService } from '../services/FundamentalsService';
import { GetNewsRequestSchema } from '../services/NewsService.request';
import { GetSentimentRequestSchema } from '../services/SentimentService.request';
import { GetFundamentalsRequestSchema } from '../services/FundamentalsService.request';
import { ToolRegistry } from './ToolRegistry';

export class ExternalDataToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly newsService: NewsService,
    private readonly sentimentService: SentimentService,
    private readonly fundamentalsService: FundamentalsService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'get_news',
      {
        title: 'Get News',
        description:
          'Get recent news articles for an instrument by ISIN. Returns article titles, publishers, links, and publish dates. No authentication required.',
        inputSchema: GetNewsRequestSchema.shape,
      },
      this.newsService.getNews.bind(this.newsService),
    );

    this.registerTool(
      'get_sentiment',
      {
        title: 'Get Sentiment',
        description:
          'Analyze sentiment for text or news articles. Provide text for direct analysis or ISIN to analyze recent news. Returns sentiment score, direction (positive/negative/neutral), and confidence. No authentication required.',
        inputSchema: GetSentimentRequestSchema._def.schema.shape,
      },
      this.sentimentService.getSentiment.bind(this.sentimentService),
    );

    this.registerTool(
      'get_fundamentals',
      {
        title: 'Get Fundamentals',
        description:
          'Get fundamental data for an instrument by ISIN. Includes company profile, financials, earnings, valuation metrics, and analyst recommendations. No authentication required.',
        inputSchema: GetFundamentalsRequestSchema.shape,
      },
      this.fundamentalsService.getFundamentals.bind(this.fundamentalsService),
    );
  }
}
