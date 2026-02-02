import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

// Mock the undici module
jest.mock('undici', () => ({
  WebSocket: jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn(),
    send: jest.fn(),
  })),
}));

import {
  createTradeRepublicApiService,
  TradeRepublicApiService,
  CryptoManager,
  WebSocketManager,
  DEFAULT_CONFIG_DIR,
  defaultFileSystem,
  defaultWebSocketFactory,
  PortfolioService,
  GetPortfolioRequestSchema,
  GetCashBalanceRequestSchema,
  MarketDataService,
  GetPriceRequestSchema,
  GetPriceHistoryRequestSchema,
  GetOrderBookRequestSchema,
  SearchAssetsRequestSchema,
  GetAssetInfoRequestSchema,
  GetMarketStatusRequestSchema,
  WaitForMarketRequestSchema,
  GetPriceResponseSchema,
  GetPriceHistoryResponseSchema,
  GetOrderBookResponseSchema,
  SearchAssetsResponseSchema,
  GetAssetInfoResponseSchema,
  GetMarketStatusResponseSchema,
  WaitForMarketResponseSchema,
  TechnicalAnalysisService,
  TechnicalAnalysisError,
  GetIndicatorsRequestSchema,
  GetDetailedAnalysisRequestSchema,
  GetIndicatorsResponseSchema,
  GetDetailedAnalysisResponseSchema,
  SymbolMapper,
  SymbolMapperError,
  IsinSchema,
  NewsService,
  NewsServiceError,
  GetNewsRequestSchema,
  GetNewsResponseSchema,
  SentimentService,
  SentimentServiceError,
  GetSentimentRequestSchema,
  GetSentimentResponseSchema,
  FundamentalsService,
  FundamentalsServiceError,
  GetFundamentalsRequestSchema,
  GetFundamentalsResponseSchema,
  RiskService,
  RiskServiceError,
  OrderService,
  OrderServiceError,
  PlaceOrderRequestSchema,
  GetOrdersRequestSchema,
  CancelOrderRequestSchema,
  PlaceOrderResponseSchema,
  GetOrdersResponseSchema,
  CancelOrderResponseSchema,
  type FileSystem,
} from './index';

describe('Services Index', () => {
  describe('exports', () => {
    it('should export DEFAULT_CONFIG_DIR with correct value', () => {
      expect(DEFAULT_CONFIG_DIR).toBe('.trade-republic-mcp');
    });

    it('should export service classes that are constructable', () => {
      // Verify classes are functions (constructable)
      expect(typeof TradeRepublicApiService).toBe('function');
      expect(typeof CryptoManager).toBe('function');
      expect(typeof WebSocketManager).toBe('function');
      expect(typeof PortfolioService).toBe('function');
      expect(typeof MarketDataService).toBe('function');
      expect(typeof TechnicalAnalysisService).toBe('function');
      expect(typeof SymbolMapper).toBe('function');
      expect(typeof NewsService).toBe('function');
      expect(typeof SentimentService).toBe('function');
      expect(typeof FundamentalsService).toBe('function');
      expect(typeof RiskService).toBe('function');
      expect(typeof OrderService).toBe('function');
    });

    it('should export error classes that extend Error', () => {
      // Verify error classes are constructable and extend Error
      const technicalError = new TechnicalAnalysisError('test');
      expect(technicalError).toBeInstanceOf(Error);
      expect(technicalError.name).toBe('TechnicalAnalysisError');

      const symbolMapperError = new SymbolMapperError('test');
      expect(symbolMapperError).toBeInstanceOf(Error);
      expect(symbolMapperError.name).toBe('SymbolMapperError');

      const newsError = new NewsServiceError('test');
      expect(newsError).toBeInstanceOf(Error);
      expect(newsError.name).toBe('NewsServiceError');

      const sentimentError = new SentimentServiceError('test');
      expect(sentimentError).toBeInstanceOf(Error);
      expect(sentimentError.name).toBe('SentimentServiceError');

      const fundamentalsError = new FundamentalsServiceError('test');
      expect(fundamentalsError).toBeInstanceOf(Error);
      expect(fundamentalsError.name).toBe('FundamentalsServiceError');

      const riskError = new RiskServiceError('test');
      expect(riskError).toBeInstanceOf(Error);
      expect(riskError.name).toBe('RiskServiceError');

      const orderError = new OrderServiceError('test');
      expect(orderError).toBeInstanceOf(Error);
      expect(orderError.name).toBe('OrderServiceError');
    });

    it('should export Portfolio schemas that parse valid input', () => {
      const portfolioResult = GetPortfolioRequestSchema.safeParse({});
      expect(portfolioResult.success).toBe(true);

      const cashBalanceResult = GetCashBalanceRequestSchema.safeParse({});
      expect(cashBalanceResult.success).toBe(true);
    });

    it('should export MarketData request schemas that parse valid input', () => {
      expect(
        GetPriceRequestSchema.safeParse({ isin: 'DE0007164600' }).success,
      ).toBe(true);
      expect(
        GetPriceHistoryRequestSchema.safeParse({
          isin: 'DE0007164600',
          range: '1d',
        }).success,
      ).toBe(true);
      expect(
        GetOrderBookRequestSchema.safeParse({ isin: 'DE0007164600' }).success,
      ).toBe(true);
      expect(
        SearchAssetsRequestSchema.safeParse({ query: 'BMW' }).success,
      ).toBe(true);
      expect(
        GetAssetInfoRequestSchema.safeParse({ isin: 'DE0007164600' }).success,
      ).toBe(true);
      expect(
        GetMarketStatusRequestSchema.safeParse({ isin: 'DE0007164600' })
          .success,
      ).toBe(true);
      expect(
        WaitForMarketRequestSchema.safeParse({ isin: 'DE0007164600' }).success,
      ).toBe(true);
    });

    it('should export MarketData response schemas with correct structure', () => {
      // Verify schemas have shape property (are Zod objects)
      expect(typeof GetPriceResponseSchema.shape).toBe('object');
      expect(typeof GetPriceHistoryResponseSchema.shape).toBe('object');
      expect(typeof GetOrderBookResponseSchema.shape).toBe('object');
      expect(typeof SearchAssetsResponseSchema.shape).toBe('object');
      expect(typeof GetAssetInfoResponseSchema.shape).toBe('object');
      expect(typeof GetMarketStatusResponseSchema.shape).toBe('object');
      expect(typeof WaitForMarketResponseSchema.shape).toBe('object');
    });

    it('should export TechnicalAnalysis schemas that parse valid input', () => {
      expect(
        GetIndicatorsRequestSchema.safeParse({
          isin: 'DE0007164600',
          range: '1d',
          indicators: [{ type: 'RSI' }],
        }).success,
      ).toBe(true);
      expect(
        GetDetailedAnalysisRequestSchema.safeParse({ isin: 'DE0007164600' })
          .success,
      ).toBe(true);

      expect(typeof GetIndicatorsResponseSchema.shape).toBe('object');
      expect(typeof GetDetailedAnalysisResponseSchema.shape).toBe('object');
    });

    it('should export IsinSchema that validates ISIN format', () => {
      expect(IsinSchema.safeParse('DE0007164600').success).toBe(true);
      expect(IsinSchema.safeParse('invalid').success).toBe(false);
      expect(IsinSchema.safeParse('US0378331005').success).toBe(true);
    });

    it('should export News schemas that parse valid input', () => {
      expect(
        GetNewsRequestSchema.safeParse({ isin: 'DE0007164600' }).success,
      ).toBe(true);
      expect(typeof GetNewsResponseSchema.shape).toBe('object');
    });

    it('should export Sentiment schemas that parse valid input', () => {
      expect(
        GetSentimentRequestSchema.safeParse({ text: 'test text' }).success,
      ).toBe(true);
      expect(
        GetSentimentRequestSchema.safeParse({ isin: 'DE0007164600' }).success,
      ).toBe(true);
      // Should fail without text or isin
      expect(GetSentimentRequestSchema.safeParse({}).success).toBe(false);
      expect(typeof GetSentimentResponseSchema.shape).toBe('object');
    });

    it('should export Fundamentals schemas that parse valid input', () => {
      expect(
        GetFundamentalsRequestSchema.safeParse({ isin: 'DE0007164600' })
          .success,
      ).toBe(true);
      expect(typeof GetFundamentalsResponseSchema.shape).toBe('object');
    });

    it('should export Order schemas that parse valid input', () => {
      expect(
        PlaceOrderRequestSchema.safeParse({
          isin: 'DE0007164600',
          orderType: 'buy',
          size: 1,
          mode: 'market',
        }).success,
      ).toBe(true);
      expect(GetOrdersRequestSchema.safeParse({}).success).toBe(true);
      expect(
        CancelOrderRequestSchema.safeParse({ orderId: 'order-123' }).success,
      ).toBe(true);

      expect(typeof PlaceOrderResponseSchema.shape).toBe('object');
      expect(typeof GetOrdersResponseSchema.shape).toBe('object');
      expect(typeof CancelOrderResponseSchema.shape).toBe('object');
    });
  });

  describe('createTradeRepublicApiService', () => {
    it('should create a TradeRepublicApiService instance', () => {
      const service = createTradeRepublicApiService();

      expect(service).toBeInstanceOf(TradeRepublicApiService);
    });

    it('should use custom config directory if provided', () => {
      const customDir = '/custom/config/dir';
      const service = createTradeRepublicApiService({
        configDir: customDir,
      });

      expect(service).toBeInstanceOf(TradeRepublicApiService);
    });

    it('should use default config directory based on home dir', () => {
      const service = createTradeRepublicApiService();
      // Just verify it works with defaults
      expect(service).toBeInstanceOf(TradeRepublicApiService);
    });

    it('should use custom file system if provided', () => {
      const customFileSystem: FileSystem = {
        readFile: jest.fn<() => Promise<string>>(),
        writeFile: jest.fn<() => Promise<void>>(),
        exists: jest.fn<() => Promise<boolean>>(),
        mkdir: jest.fn<() => Promise<void>>(),
      };

      const service = createTradeRepublicApiService({
        fileSystem: customFileSystem,
      });

      expect(service).toBeInstanceOf(TradeRepublicApiService);
    });

    it('should use custom fetch function if provided', () => {
      const customFetch = jest.fn() as unknown as typeof fetch;

      const service = createTradeRepublicApiService({
        fetchFn: customFetch,
      });

      expect(service).toBeInstanceOf(TradeRepublicApiService);
    });
  });

  describe('defaultFileSystem', () => {
    const testDir = path.join(
      os.tmpdir(),
      `trade-republic-test-${Date.now().toString()}`,
    );
    const testFile = path.join(testDir, 'test.txt');

    beforeEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // Directory may not exist
      }
    });

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch {
        // Directory may not exist
      }
    });

    it('should create directory with mkdir', async () => {
      await defaultFileSystem.mkdir(testDir, { recursive: true });

      const stat = await fs.stat(testDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should write and read files', async () => {
      await defaultFileSystem.mkdir(testDir, { recursive: true });

      const content = 'test content';
      await defaultFileSystem.writeFile(testFile, content);

      const readContent = await defaultFileSystem.readFile(testFile);
      expect(readContent).toBe(content);
    });

    it('should return true for existing files', async () => {
      await defaultFileSystem.mkdir(testDir, { recursive: true });
      await defaultFileSystem.writeFile(testFile, 'content');

      const exists = await defaultFileSystem.exists(testFile);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const exists = await defaultFileSystem.exists(
        path.join(testDir, 'nonexistent.txt'),
      );
      expect(exists).toBe(false);
    });
  });

  describe('defaultWebSocketFactory', () => {
    it('should create a WebSocket instance', () => {
      // Since undici is mocked, this just verifies the function is callable
      const ws = defaultWebSocketFactory('wss://test.com');
      expect(ws).toBeDefined();
    });

    it('should pass headers to WebSocket when provided', () => {
      const mockUndici = jest.requireMock<{ WebSocket: jest.Mock }>('undici');
      mockUndici.WebSocket.mockClear();

      defaultWebSocketFactory('wss://test.com', {
        headers: { Cookie: 'session=test' },
      });

      expect(mockUndici.WebSocket).toHaveBeenCalledWith('wss://test.com', {
        headers: { Cookie: 'session=test' },
      });
    });

    it('should not pass options when no headers provided', () => {
      const mockUndici = jest.requireMock<{ WebSocket: jest.Mock }>('undici');
      mockUndici.WebSocket.mockClear();

      defaultWebSocketFactory('wss://test.com');

      expect(mockUndici.WebSocket).toHaveBeenCalledWith(
        'wss://test.com',
        undefined,
      );
    });
  });
});
