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

// Mock the ws module
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
    send: jest.fn(),
  }));
});

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
  type FileSystem,
} from './index';

describe('Services Index', () => {
  describe('exports', () => {
    it('should export TradeRepublicApiService', () => {
      expect(TradeRepublicApiService).toBeDefined();
    });

    it('should export CryptoManager', () => {
      expect(CryptoManager).toBeDefined();
    });

    it('should export WebSocketManager', () => {
      expect(WebSocketManager).toBeDefined();
    });

    it('should export DEFAULT_CONFIG_DIR', () => {
      expect(DEFAULT_CONFIG_DIR).toBe('.trade-republic-mcp');
    });

    it('should export PortfolioService', () => {
      expect(PortfolioService).toBeDefined();
    });

    it('should export Portfolio request schemas', () => {
      expect(GetPortfolioRequestSchema).toBeDefined();
      expect(GetCashBalanceRequestSchema).toBeDefined();
    });

    it('should export MarketDataService', () => {
      expect(MarketDataService).toBeDefined();
    });

    it('should export MarketData request schemas', () => {
      expect(GetPriceRequestSchema).toBeDefined();
      expect(GetPriceHistoryRequestSchema).toBeDefined();
      expect(GetOrderBookRequestSchema).toBeDefined();
      expect(SearchAssetsRequestSchema).toBeDefined();
      expect(GetAssetInfoRequestSchema).toBeDefined();
      expect(GetMarketStatusRequestSchema).toBeDefined();
      expect(WaitForMarketRequestSchema).toBeDefined();
    });

    it('should export MarketData response schemas', () => {
      expect(GetPriceResponseSchema).toBeDefined();
      expect(GetPriceHistoryResponseSchema).toBeDefined();
      expect(GetOrderBookResponseSchema).toBeDefined();
      expect(SearchAssetsResponseSchema).toBeDefined();
      expect(GetAssetInfoResponseSchema).toBeDefined();
      expect(GetMarketStatusResponseSchema).toBeDefined();
      expect(WaitForMarketResponseSchema).toBeDefined();
    });

    it('should export TechnicalAnalysisService', () => {
      expect(TechnicalAnalysisService).toBeDefined();
    });

    it('should export TechnicalAnalysisError', () => {
      expect(TechnicalAnalysisError).toBeDefined();
    });

    it('should export TechnicalAnalysis request schemas', () => {
      expect(GetIndicatorsRequestSchema).toBeDefined();
      expect(GetDetailedAnalysisRequestSchema).toBeDefined();
    });

    it('should export TechnicalAnalysis response schemas', () => {
      expect(GetIndicatorsResponseSchema).toBeDefined();
      expect(GetDetailedAnalysisResponseSchema).toBeDefined();
    });

    it('should export SymbolMapper and related', () => {
      expect(SymbolMapper).toBeDefined();
      expect(SymbolMapperError).toBeDefined();
      expect(IsinSchema).toBeDefined();
    });

    it('should export NewsService and related', () => {
      expect(NewsService).toBeDefined();
      expect(NewsServiceError).toBeDefined();
      expect(GetNewsRequestSchema).toBeDefined();
      expect(GetNewsResponseSchema).toBeDefined();
    });

    it('should export SentimentService and related', () => {
      expect(SentimentService).toBeDefined();
      expect(SentimentServiceError).toBeDefined();
      expect(GetSentimentRequestSchema).toBeDefined();
      expect(GetSentimentResponseSchema).toBeDefined();
    });

    it('should export FundamentalsService and related', () => {
      expect(FundamentalsService).toBeDefined();
      expect(FundamentalsServiceError).toBeDefined();
      expect(GetFundamentalsRequestSchema).toBeDefined();
      expect(GetFundamentalsResponseSchema).toBeDefined();
    });

    it('should export RiskService and related', () => {
      expect(RiskService).toBeDefined();
      expect(RiskServiceError).toBeDefined();
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
      // Since ws is mocked, this just verifies the function is callable
      const ws = defaultWebSocketFactory('wss://test.com');
      expect(ws).toBeDefined();
    });
  });
});
