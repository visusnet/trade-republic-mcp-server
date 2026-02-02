import { describe, it, expect, jest } from '@jest/globals';

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
  TradeRepublicApiService,
  TradeRepublicCredentials,
  CryptoManager,
  WebSocketManager,
  DEFAULT_CONFIG_DIR,
  TwoFactorCodeRequiredException,
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
  MarketEventService,
  MarketEventError,
  WaitForMarketEventRequestSchema,
  WaitForMarketEventResponseSchema,
} from './index';

describe('Services Index', () => {
  describe('exports', () => {
    it('should export DEFAULT_CONFIG_DIR with correct value', () => {
      expect(DEFAULT_CONFIG_DIR).toBe('.trade-republic-mcp');
    });

    it('should export service classes that are constructable', () => {
      // Verify classes are functions (constructable)
      expect(typeof TradeRepublicApiService).toBe('function');
      expect(typeof TradeRepublicCredentials).toBe('function');
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
      expect(typeof MarketEventService).toBe('function');
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

      const marketEventError = new MarketEventError('test');
      expect(marketEventError).toBeInstanceOf(Error);
      expect(marketEventError.name).toBe('MarketEventError');

      const twoFactorError = new TwoFactorCodeRequiredException('+49123***90');
      expect(twoFactorError).toBeInstanceOf(Error);
      expect(twoFactorError.name).toBe('TwoFactorCodeRequiredException');
      expect(twoFactorError.message).toContain('2FA code required');
      expect(twoFactorError.message).toContain('+49123***90');
      expect(twoFactorError.code).toBe('TWO_FACTOR_REQUIRED');
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

    it('should export MarketEvent schemas that parse valid input', () => {
      expect(
        WaitForMarketEventRequestSchema.safeParse({
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'gt', value: 100 }],
            },
          ],
        }).success,
      ).toBe(true);

      // WaitForMarketEventResponseSchema is a discriminated union, not an object with shape
      expect(
        WaitForMarketEventResponseSchema.safeParse({
          status: 'timeout',
          lastTickers: {},
          duration: 55,
          timestamp: '2025-01-25T12:00:00.000Z',
        }).success,
      ).toBe(true);
    });
  });
});
