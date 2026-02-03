import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import request from 'supertest';
import * as StreamableHttpModule from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { mockLogger } from '@test/loggerMock';
import {
  mockTradeRepublicApiService,
  mockPortfolioService,
  mockMarketDataService,
  mockOrderService,
  mockTechnicalAnalysisService,
  mockMarketEventService,
  mockNewsService,
  mockSentimentService,
  mockFundamentalsService,
  mockRiskService,
  mockServices,
} from '@test/serviceMocks';
import { AuthStatus } from './services/TradeRepublicApiService.types';

const logger = mockLogger();
jest.mock('../logger', () => ({ logger }));

mockServices();

import { TradeRepublicMcpServer } from './TradeRepublicMcpServer';

const TEST_PHONE_NUMBER = '+4917012345678';
const TEST_PIN = '1234';

describe('TradeRepublicMcpServer Integration Tests', () => {
  let server: TradeRepublicMcpServer;
  let client: Client;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTradeRepublicApiService.getAuthStatus.mockReturnValue(
      AuthStatus.AUTHENTICATED,
    );
    mockTradeRepublicApiService.subscribe.mockReturnValue(1);
    mockTradeRepublicApiService.enterTwoFactorCode.mockResolvedValue({
      message: 'Authentication successful',
    });
    server = new TradeRepublicMcpServer(TEST_PHONE_NUMBER, TEST_PIN);
    const mcpServer = server.getMcpServer();
    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      mcpServer.connect(serverTransport),
    ]);
  });

  describe('Tools', () => {
    describe('Portfolio', () => {
      it('should call getPortfolio via MCP tool get_portfolio', async () => {
        const result = {
          positions: [
            {
              instrumentId: 'DE0007164600',
              netSize: 10,
              netValue: 1000,
              averageCost: 95,
              realisedProfit: 50,
            },
          ],
          netValue: 1000,
        };
        mockPortfolioService.getPortfolio.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_portfolio',
          arguments: {},
        });

        expect(mockPortfolioService.getPortfolio).toHaveBeenCalled();
        expectResponseToContain(response, result);
      });

      it('should call getCashBalance via MCP tool get_cash_balance', async () => {
        const result = { availableCash: 5000, currency: 'EUR' };
        mockPortfolioService.getCashBalance.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_cash_balance',
          arguments: {},
        });

        expect(mockPortfolioService.getCashBalance).toHaveBeenCalled();
        expectResponseToContain(response, result);
      });
    });

    describe('Market Data', () => {
      it('should call getPrice via MCP tool get_price', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
          exchange: 'LSX',
          bid: 100,
          ask: 101,
          spread: 1,
          spreadPercent: 0.99,
          last: 100.5,
        };
        mockMarketDataService.getPrice.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_price',
          arguments: args,
        });

        expect(mockMarketDataService.getPrice).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });

      it('should call getPriceHistory via MCP tool get_price_history', async () => {
        const args = { isin: 'DE0007164600', range: '1d' };
        const result = {
          isin: 'DE0007164600',
          range: '1d',
          exchange: 'LSX',
          candles: [],
        };
        mockMarketDataService.getPriceHistory.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_price_history',
          arguments: args,
        });

        expect(mockMarketDataService.getPriceHistory).toHaveBeenCalledWith(
          args,
        );
        expectResponseToContain(response, result);
      });

      it('should call getOrderBook via MCP tool get_order_book', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
          exchange: 'LSX',
          spread: 1,
          bids: [],
          asks: [],
          midPrice: 100.5,
        };
        mockMarketDataService.getOrderBook.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_order_book',
          arguments: args,
        });

        expect(mockMarketDataService.getOrderBook).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });

      it('should call searchAssets via MCP tool search_assets', async () => {
        const args = { query: 'SAP' };
        const result = { results: [], totalCount: 0 };
        mockMarketDataService.searchAssets.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'search_assets',
          arguments: args,
        });

        expect(mockMarketDataService.searchAssets).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });

      it('should call getAssetInfo via MCP tool get_asset_info', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          isin: 'DE0007164600',
          name: 'SAP SE',
          type: 'stock',
          timestamp: '2026-02-01T12:00:00Z',
        };
        mockMarketDataService.getAssetInfo.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_asset_info',
          arguments: args,
        });

        expect(mockMarketDataService.getAssetInfo).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });

      it('should call getMarketStatus via MCP tool get_market_status', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          isin: 'DE0007164600',
          status: 'open' as const,
          timestamp: '2026-02-01T12:00:00Z',
          exchange: 'LSX',
          isOpen: true,
          hasBid: true,
          hasAsk: true,
        };
        mockMarketDataService.getMarketStatus.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_market_status',
          arguments: args,
        });

        expect(mockMarketDataService.getMarketStatus).toHaveBeenCalled();
        expectResponseToContain(response, result);
      });

      it('should call waitForMarket via MCP tool wait_for_market', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
          exchange: 'LSX',
          isOpen: true,
          waitedMs: 0,
          timedOut: false,
        };
        mockMarketDataService.waitForMarket.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'wait_for_market',
          arguments: args,
        });

        expect(mockMarketDataService.waitForMarket).toHaveBeenCalled();
        expectResponseToContain(response, result);
      });
    });

    describe('Execution', () => {
      it('should call placeOrder via MCP tool place_order', async () => {
        const args = {
          isin: 'DE0007164600',
          orderType: 'buy',
          mode: 'market',
          size: 10,
        };
        const result = {
          orderId: 'order-123',
          status: 'pending',
          isin: 'DE0007164600',
          exchange: 'LSX',
          orderType: 'buy' as const,
          mode: 'market' as const,
          size: 10,
          timestamp: '2026-02-01T12:00:00Z',
        };
        mockOrderService.placeOrder.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'place_order',
          arguments: args,
        });

        expect(mockOrderService.placeOrder).toHaveBeenCalledWith(
          expect.objectContaining(args),
        );
        expectResponseToContain(response, result);
      });

      it('should call getOrders via MCP tool get_orders', async () => {
        const result = {
          orders: [],
          totalCount: 0,
          timestamp: '2026-02-01T12:00:00Z',
        };
        mockOrderService.getOrders.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_orders',
          arguments: {},
        });

        expect(mockOrderService.getOrders).toHaveBeenCalled();
        expectResponseToContain(response, result);
      });

      it('should call modifyOrder via MCP tool modify_order', async () => {
        const args = { orderId: 'order-123', limitPrice: 100 };
        mockOrderService.modifyOrder.mockImplementation(() => {
          throw new Error('Order modification not supported');
        });

        const response = await client.callTool({
          name: 'modify_order',
          arguments: args,
        });

        expect(mockOrderService.modifyOrder).toHaveBeenCalledWith(args);
        expect(response).toEqual({
          content: [{ text: 'Order modification not supported', type: 'text' }],
          isError: true,
        });
      });

      it('should call cancelOrder via MCP tool cancel_order', async () => {
        const args = { orderId: 'order-123' };
        const result = {
          orderId: 'order-123',
          status: 'cancelled',
          cancelled: true,
          timestamp: '2026-02-01T12:00:00Z',
        };
        mockOrderService.cancelOrder.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'cancel_order',
          arguments: args,
        });

        expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });
    });

    describe('Technical Analysis', () => {
      it('should call getIndicators via MCP tool get_indicators', async () => {
        const args = {
          isin: 'DE0007164600',
          range: '1d' as const,
          indicators: [{ type: 'RSI' as const }],
        };
        const result = {
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
          range: '1d',
          exchange: 'LSX',
          indicators: [],
          candleCount: 100,
        };
        mockTechnicalAnalysisService.getIndicators.mockResolvedValueOnce(
          result,
        );

        const response = await client.callTool({
          name: 'get_indicators',
          arguments: args,
        });

        expect(mockTechnicalAnalysisService.getIndicators).toHaveBeenCalledWith(
          args,
        );
        expectResponseToContain(response, result);
      });

      it('should call getDetailedAnalysis via MCP tool get_detailed_analysis', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
          range: '1d',
          exchange: 'LSX',
          summary: {
            score: 50,
            confidence: 0.7,
            overallSignal: 'hold' as const,
            bullishCount: 3,
            bearishCount: 2,
            neutralCount: 5,
          },
          indicators: {
            rsi: null,
            macd: { signal: null, macd: null, histogram: null },
            bollingerBands: {
              upper: null,
              middle: null,
              lower: null,
              pb: null,
            },
            stochastic: { k: null, d: null },
            adx: null,
            atr: null,
          },
          currentPrice: 100,
          trend: {
            direction: 'sideways' as const,
            strength: 'moderate' as const,
            sma20: null,
            sma50: null,
          },
          signals: [],
        };
        mockTechnicalAnalysisService.getDetailedAnalysis.mockResolvedValueOnce(
          result,
        );

        const response = await client.callTool({
          name: 'get_detailed_analysis',
          arguments: args,
        });

        expect(
          mockTechnicalAnalysisService.getDetailedAnalysis,
        ).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });
    });

    describe('Market Events', () => {
      it('should call waitForMarketEvent via MCP tool wait_for_market_event', async () => {
        const args = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'gt', value: 100 }],
            },
          ],
        };
        const result = {
          status: 'triggered' as const,
          isin: 'DE0007164600',
          exchange: 'LSX',
          triggeredConditions: [
            { field: 'bid', operator: 'gt', threshold: 100, actualValue: 101 },
          ],
          ticker: {
            bid: 101,
            ask: 102,
            mid: 101.5,
            spread: 1,
            spreadPercent: 1,
          },
          timestamp: '2026-02-01T12:00:00Z',
        };
        mockMarketEventService.waitForMarketEvent.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'wait_for_market_event',
          arguments: args,
        });

        expect(mockMarketEventService.waitForMarketEvent).toHaveBeenCalledWith({
          ...args,
          timeout: 55,
          subscriptions: [{ ...args.subscriptions[0], logic: 'any' }],
        });
        expectResponseToContain(response, result);
      });

      it('should handle wait_for_market_event timeout', async () => {
        const args = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'lt', value: 50 }],
            },
          ],
          timeout: 30,
        };
        const result = {
          status: 'timeout' as const,
          lastTickers: {},
          duration: 30,
          timestamp: '2026-02-01T12:00:30Z',
        };
        mockMarketEventService.waitForMarketEvent.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'wait_for_market_event',
          arguments: args,
        });

        expectResponseToContain(response, result);
      });
    });

    describe('External Data', () => {
      it('should call getNews via MCP tool get_news', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          symbol: 'SAP',
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
          totalCount: 0,
          articles: [],
        };
        mockNewsService.getNews.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_news',
          arguments: args,
        });

        expect(mockNewsService.getNews).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });

      it('should call getSentiment via MCP tool get_sentiment', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          timestamp: '2026-02-01T12:00:00Z',
          overallScore: 0.5,
          overallDirection: 'positive' as const,
          confidence: 'medium' as const,
          analysis: [],
          summary: 'Neutral sentiment',
        };
        mockSentimentService.getSentiment.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_sentiment',
          arguments: args,
        });

        expect(mockSentimentService.getSentiment).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });

      it('should call getFundamentals via MCP tool get_fundamentals', async () => {
        const args = { isin: 'DE0007164600' };
        const result = {
          symbol: 'SAP',
          isin: 'DE0007164600',
          timestamp: '2026-02-01T12:00:00Z',
        };
        mockFundamentalsService.getFundamentals.mockResolvedValueOnce(result);

        const response = await client.callTool({
          name: 'get_fundamentals',
          arguments: args,
        });

        expect(mockFundamentalsService.getFundamentals).toHaveBeenCalledWith(
          args,
        );
        expectResponseToContain(response, result);
      });
    });

    describe('Risk Management', () => {
      it('should call calculatePositionSize via MCP tool calculate_position_size', async () => {
        const args = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        };
        const result = {
          timestamp: '2026-02-01T12:00:00Z',
          warnings: [],
          kellyPercentage: 20,
          adjustedPercentage: 10,
          positionSizeAmount: 1000,
          maxPositionSize: 1000,
          availableCapital: 10000,
          winLossRatio: 2,
        };
        mockRiskService.calculatePositionSize.mockReturnValueOnce(result);

        const response = await client.callTool({
          name: 'calculate_position_size',
          arguments: args,
        });

        expect(mockRiskService.calculatePositionSize).toHaveBeenCalledWith(
          args,
        );
        expectResponseToContain(response, result);
      });

      it('should call getRiskMetrics via MCP tool get_risk_metrics', async () => {
        const args = {
          prices: [100, 101, 99, 98, 100],
        };
        const result = {
          timestamp: '2026-02-01T12:00:00Z',
          timeframe: 'daily' as const,
          volatility: { daily: 0.015, annualized: 0.24 },
          valueAtRisk: {
            historical: 0.02,
            parametric: 0.025,
            confidenceLevel: '95%',
          },
          maxDrawdown: {
            value: 0.03,
            percent: 3,
            peakIndex: 0,
            troughIndex: 3,
          },
          sharpeRatio: 1.5,
          returns: { annualized: 0.12, total: 0.015, mean: 0.005 },
          dataPoints: 5,
        };
        mockRiskService.getRiskMetrics.mockReturnValueOnce(result);

        const response = await client.callTool({
          name: 'get_risk_metrics',
          arguments: args,
        });

        expect(mockRiskService.getRiskMetrics).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });
    });

    describe('Auth', () => {
      it('should call enterTwoFactorCode via MCP tool enter_two_factor_code', async () => {
        const args = { code: '123456' };
        const result = { message: 'Authentication successful' };
        mockTradeRepublicApiService.enterTwoFactorCode.mockResolvedValueOnce(
          result,
        );

        const response = await client.callTool({
          name: 'enter_two_factor_code',
          arguments: args,
        });

        expect(
          mockTradeRepublicApiService.enterTwoFactorCode,
        ).toHaveBeenCalledWith(args);
        expectResponseToContain(response, result);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for unknown tool', async () => {
        expect(
          await client.callTool({
            name: 'unknown_tool',
            arguments: {},
          }),
        ).toEqual({
          content: [
            {
              text: 'MCP error -32602: Tool unknown_tool not found',
              type: 'text',
            },
          ],
          isError: true,
        });
      });

      it('should handle tool method errors gracefully', async () => {
        mockPortfolioService.getPortfolio.mockRejectedValueOnce(
          new Error('API error'),
        );

        const response = await client.callTool({
          name: 'get_portfolio',
          arguments: {},
        });

        expect(mockPortfolioService.getPortfolio).toHaveBeenCalled();
        expect(response).toEqual({
          content: [{ text: 'API error', type: 'text' }],
          isError: true,
        });
      });

      it('should handle tool method (non-Error) errors gracefully', async () => {
        mockPortfolioService.getPortfolio.mockRejectedValueOnce(
          'Unexpected error format',
        );

        const response = await client.callTool({
          name: 'get_portfolio',
          arguments: {},
        });

        expect(mockPortfolioService.getPortfolio).toHaveBeenCalled();
        expect(response).toEqual({
          content: [{ text: 'Unexpected error format', type: 'text' }],
          isError: true,
        });
      });
    });
  });

  describe('Prompts', () => {
    it('should register assist prompt', async () => {
      const prompts = await client.listPrompts({});
      expect(prompts.prompts).toHaveLength(1);
      expect(prompts.prompts[0].name).toBe('assist');
    });

    it('should return trading assistant prompt content', async () => {
      const result = await client.getPrompt({ name: 'assist', arguments: {} });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      const contentStr = JSON.stringify(result.messages[0].content);
      expect(contentStr).toContain('Trade Republic');
      expect(contentStr).toContain('TOOL CATEGORIES');
    });
  });

  describe('Server Methods', () => {
    it('should return express app', () => {
      const app = server.getExpressApp();
      expect(app).toBeDefined();
    });

    it('should return MCP server instance', () => {
      const mcpServer = server.getMcpServer();
      expect(mcpServer).toBeDefined();
    });

    it('should start listening on specified port', () => {
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn((_port: number, callback: () => void) => {
        callback();
        return mockServer;
      });
      const app = server.getExpressApp();
      Object.defineProperty(app, 'listen', {
        value: mockListen,
        writable: true,
      });

      server.listen(3000);

      expect(mockListen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(logger.server.info).toHaveBeenCalledWith(
        'Trade Republic MCP Server listening on port 3000',
      );
      expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle EADDRINUSE error with helpful message', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn(() => mockServer);
      const app = server.getExpressApp();
      Object.defineProperty(app, 'listen', {
        value: mockListen,
        writable: true,
      });

      server.listen(3000);

      const errorHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1] as (error: NodeJS.ErrnoException) => void;
      const error: NodeJS.ErrnoException = new Error('address in use');
      error.code = 'EADDRINUSE';
      errorHandler(error);

      expect(logger.server.error).toHaveBeenCalledWith(
        'Port 3000 is already in use',
      );
      expect(logger.server.error).toHaveBeenCalledWith(
        'Try a different port with: PORT=<port> npm start',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });

    it('should handle other server errors', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const mockServer = { on: jest.fn() };
      const mockListen = jest.fn(() => mockServer);
      const app = server.getExpressApp();
      Object.defineProperty(app, 'listen', {
        value: mockListen,
        writable: true,
      });

      server.listen(3000);

      const errorHandler = mockServer.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1] as (error: NodeJS.ErrnoException) => void;
      const error: NodeJS.ErrnoException = new Error('permission denied');
      error.code = 'EACCES';
      errorHandler(error);

      expect(logger.server.error).toHaveBeenCalledWith(
        'Error starting server: permission denied',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });

    it('should register SIGTERM and SIGINT shutdown handlers on listen', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      stubExpressListen(server);

      server.listen(3000);

      expect(processOnSpy).toHaveBeenCalledWith(
        'SIGTERM',
        expect.any(Function),
      );
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      processOnSpy.mockRestore();
    });

    it('should close HTTP server on shutdown signal', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn((cb: () => void) => {
        cb();
      });
      stubExpressListen(server, { close: mockServerClose });

      server.listen(3000);
      simulateSignal(processOnSpy, 'SIGTERM');

      expect(logger.server.info).toHaveBeenCalledWith('Shutting down...');
      expect(mockServerClose).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);

      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should close HTTP server on SIGINT', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn((cb: () => void) => {
        cb();
      });
      stubExpressListen(server, { close: mockServerClose });

      server.listen(3000);
      simulateSignal(processOnSpy, 'SIGINT');

      expect(logger.server.info).toHaveBeenCalledWith('Shutting down...');
      expect(mockServerClose).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);

      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should force exit when server.close hangs', () => {
      jest.useFakeTimers();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn();
      stubExpressListen(server, { close: mockServerClose });

      server.listen(3000);
      simulateSignal(processOnSpy, 'SIGTERM');

      expect(mockServerClose).toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10_000);

      expect(logger.server.error).toHaveBeenCalledWith(
        'Graceful shutdown timed out, forcing exit',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should only run shutdown once when SIGTERM is followed by SIGINT', () => {
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      const mockServerClose = jest.fn();
      stubExpressListen(server, { close: mockServerClose });

      server.listen(3000);
      simulateSignal(processOnSpy, 'SIGTERM');
      simulateSignal(processOnSpy, 'SIGINT');

      expect(mockServerClose).toHaveBeenCalledTimes(1);

      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });
  });

  describe('Streamable HTTP Routes', () => {
    it('should respond with 405 for GET /mcp requests', async () => {
      const app = server.getExpressApp();

      const response = await request(app).get('/mcp');

      expect(response.status).toBe(405);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not allowed. Use POST for MCP requests.',
        },
        id: null,
      });
    });

    it('should accept POST /mcp requests', async () => {
      const app = server.getExpressApp();

      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'ping', id: 1 })
        .set('Content-Type', 'application/json');

      // Should get some kind of response (not 404)
      expect(response.status).not.toBe(404);
    });

    it('should handle errors in POST /mcp with 500 response', async () => {
      // Spy on StreamableHTTPServerTransport to make it throw an error
      const spy = jest
        .spyOn(StreamableHttpModule, 'StreamableHTTPServerTransport')
        .mockImplementationOnce(() => {
          throw new Error('Transport initialization failed');
        });

      // Create a new server instance for this test after setting up the spy
      const testServer = new TradeRepublicMcpServer(
        TEST_PHONE_NUMBER,
        TEST_PIN,
      );
      const app = testServer.getExpressApp();

      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
      expect(logger.server.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error handling MCP request',
      );

      spy.mockRestore();
    });
  });
});

// Stubs app.listen to avoid binding a real port, with optional server overrides
function stubExpressListen(
  trServer: TradeRepublicMcpServer,
  serverOverrides: Record<string, unknown> = {},
): void {
  const mockServer = { on: jest.fn(), ...serverOverrides };
  const mockListen = jest.fn((_port: number, callback: () => void) => {
    callback();
    return mockServer;
  });
  Object.defineProperty(trServer.getExpressApp(), 'listen', {
    value: mockListen,
    writable: true,
  });
}

// Finds and invokes a signal handler captured by a process.on spy
function simulateSignal(
  processOnSpy: jest.SpiedFunction<typeof process.on>,
  signal: string,
): void {
  const handler = processOnSpy.mock.calls.find(
    (call) => call[0] === signal,
  )?.[1] as (() => void) | undefined;
  if (!handler) {
    throw new Error(`No handler registered for signal '${signal}'`);
  }
  handler();
}

// Helper function to validate tool response contains expected data
function expectResponseToContain(
  response: unknown,
  expectedData: unknown,
): void {
  const result = response as CallToolResult;
  // Type guard to ensure response has content
  if (!('content' in result)) {
    throw new Error('Response does not have content property');
  }
  expect(result.content).toBeDefined();
  expect(Array.isArray(result.content)).toBe(true);
  const content = result.content as unknown[];
  expect(content.length).toBeGreaterThan(0);
  const firstContent = content[0] as Record<string, unknown>;
  expect(firstContent).toHaveProperty('text');
  const textContent = String(firstContent.text);
  // Parse and compare the JSON data
  const parsedContent = JSON.parse(textContent) as unknown;
  expect(parsedContent).toEqual(expectedData);
}
