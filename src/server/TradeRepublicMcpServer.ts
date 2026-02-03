import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, Request, Response } from 'express';

import { logger } from '../logger';
import { FundamentalsService } from './services/FundamentalsService';
import { MarketDataService } from './services/MarketDataService';
import { MarketEventService } from './services/MarketEventService';
import { NewsService } from './services/NewsService';
import { OrderService } from './services/OrderService';
import { PortfolioService } from './services/PortfolioService';
import { RiskService } from './services/RiskService';
import { SentimentService } from './services/SentimentService';
import { SymbolMapper } from './services/SymbolMapper';
import { TechnicalAnalysisService } from './services/TechnicalAnalysisService';
import { TradeRepublicApiService } from './services/TradeRepublicApiService';
import { TradeRepublicCredentials } from './services/TradeRepublicCredentials';
import { AuthToolRegistry } from './tools/AuthToolRegistry';
import { ExecutionToolRegistry } from './tools/ExecutionToolRegistry';
import { ExternalDataToolRegistry } from './tools/ExternalDataToolRegistry';
import { MarketDataToolRegistry } from './tools/MarketDataToolRegistry';
import { MarketEventToolRegistry } from './tools/MarketEventToolRegistry';
import { PortfolioToolRegistry } from './tools/PortfolioToolRegistry';
import { RiskManagementToolRegistry } from './tools/RiskManagementToolRegistry';
import { TechnicalAnalysisToolRegistry } from './tools/TechnicalAnalysisToolRegistry';
import { ToolRegistry } from './tools/ToolRegistry';

export class TradeRepublicMcpServer {
  private readonly app: Express;
  private readonly apiService: TradeRepublicApiService;
  private readonly portfolioService: PortfolioService;
  private readonly marketDataService: MarketDataService;
  private readonly technicalAnalysisService: TechnicalAnalysisService;
  private readonly orderService: OrderService;
  private readonly marketEventService: MarketEventService;
  private readonly newsService: NewsService;
  private readonly sentimentService: SentimentService;
  private readonly fundamentalsService: FundamentalsService;
  private readonly riskService: RiskService;

  constructor(phoneNumber: string, pin: string) {
    const credentials = new TradeRepublicCredentials(phoneNumber, pin);
    this.apiService = new TradeRepublicApiService(credentials);

    // Initialize all services
    this.portfolioService = new PortfolioService(this.apiService);
    this.marketDataService = new MarketDataService(this.apiService);
    this.technicalAnalysisService = new TechnicalAnalysisService(
      this.marketDataService,
    );
    this.orderService = new OrderService(this.apiService);
    this.marketEventService = new MarketEventService(this.apiService);

    const symbolMapper = new SymbolMapper();
    this.newsService = new NewsService(symbolMapper);
    this.sentimentService = new SentimentService(this.newsService);
    this.fundamentalsService = new FundamentalsService(symbolMapper);
    this.riskService = new RiskService();

    this.app = createMcpExpressApp();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/mcp', async (req: Request, res: Response) => {
      const server = this.createMcpServerInstance();
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
          void transport.close();
          void server.close();
        });
      } catch (error) {
        logger.server.error({ err: error }, 'Error handling MCP request');
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });

    this.app.get('/mcp', (_req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not allowed. Use POST for MCP requests.',
        },
        id: null,
      });
    });
  }

  private registerPromptsForServer(server: McpServer): void {
    server.registerPrompt(
      'assist',
      {
        description: 'A prompt to help with trading on Trade Republic',
      },
      () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a Trade Republic trading assistant.

TOOL CATEGORIES (to be implemented):
- Portfolio: get_portfolio, get_cash_balance
- Market Data: get_price, get_price_history, get_order_book, search_assets, get_asset_info, get_market_status, wait_for_market
- Market Events: wait_for_market_event (event-driven triggers based on price conditions)
- Technical Analysis: get_indicators, get_detailed_analysis
- External Data: get_news, get_sentiment, get_fundamentals
- Risk Management: calculate_position_size, get_risk_metrics
- Execution: place_order, get_orders, modify_order, cancel_order

BEST PRACTICES:
1. Always check portfolio and cash balance before trading
2. Use get_market_status to verify market is open
3. Use get_indicators for technical analysis before trading decisions
4. Consider risk metrics and position sizing for all trades
5. Monitor news and sentiment for event-driven opportunities
6. Use limit orders when possible for better execution
7. Respect hard limits: max 10% position size, max 5% daily loss, min 10% cash reserve`,
            },
          },
        ],
      }),
    );
  }

  public getExpressApp(): Express {
    return this.app;
  }

  public getMcpServer(): McpServer {
    return this.createMcpServerInstance();
  }

  private registerToolsForServer(server: McpServer): void {
    const registries: ToolRegistry[] = [
      new PortfolioToolRegistry(server, this.portfolioService),
      new MarketDataToolRegistry(server, this.marketDataService),
      new TechnicalAnalysisToolRegistry(server, this.technicalAnalysisService),
      new ExecutionToolRegistry(server, this.orderService),
      new MarketEventToolRegistry(server, this.marketEventService),
      new AuthToolRegistry(server, this.apiService),
      new ExternalDataToolRegistry(
        server,
        this.newsService,
        this.sentimentService,
        this.fundamentalsService,
      ),
      new RiskManagementToolRegistry(server, this.riskService),
    ];

    registries.forEach((r) => {
      r.register();
    });
  }

  private createMcpServerInstance(): McpServer {
    const server = new McpServer(
      { name: 'trade-republic-mcp-server', version: '0.1.0' },
      { capabilities: { tools: {}, prompts: {} } },
    );
    this.registerPromptsForServer(server);
    this.registerToolsForServer(server);
    return server;
  }

  public listen(port: number): void {
    const server = this.app.listen(port, () => {
      logger.server.info(`Trade Republic MCP Server listening on port ${port}`);
    });

    let isShuttingDown = false;
    const shutdown = (): void => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      logger.server.info('Shutting down...');

      const forceExitTimeout = setTimeout(() => {
        logger.server.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
      }, 10_000);
      forceExitTimeout.unref();

      server.close(() => {
        clearTimeout(forceExitTimeout);
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.server.error(`Port ${port} is already in use`);
        logger.server.error('Try a different port with: PORT=<port> npm start');
      } else {
        logger.server.error(`Error starting server: ${error.message}`);
      }
      process.exit(1);
    });
  }
}
