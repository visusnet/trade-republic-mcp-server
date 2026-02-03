/**
 * Centralized mock services for Trade Republic.
 *
 * These mocks are used with jest.mock() to replace entire service modules.
 * For fine-grained control over individual methods in tests, define standalone
 * mock functions in the test file itself (see coinbase pattern).
 *
 * Usage with jest.mock():
 * ```typescript
 * import { mockNewsService } from '@test/serviceMocks';
 *
 * jest.mock('../services/NewsService', () => ({
 *   NewsService: jest.fn().mockImplementation(() => mockNewsService),
 * }));
 * ```
 *
 * Usage for direct mock assertions in tests:
 * ```typescript
 * // Define standalone mocks in the test file
 * const getNewsMock = jest.fn<NewsService['getNews']>();
 *
 * // Build mock object from standalone mocks
 * mockNewsService = { getNews: getNewsMock } as never;
 *
 * // Use standalone mock for assertions
 * expect(getNewsMock).toHaveBeenCalledWith(...);
 * ```
 */

import { jest } from '@jest/globals';

import type { TradeRepublicApiService } from '../server/services/TradeRepublicApiService';
import type { MarketDataService } from '../server/services/MarketDataService';
import type { OrderService } from '../server/services/OrderService';
import type { PortfolioService } from '../server/services/PortfolioService';
import type { NewsService } from '../server/services/NewsService';
import type { SentimentService } from '../server/services/SentimentService';
import type { FundamentalsService } from '../server/services/FundamentalsService';
import type { TechnicalAnalysisService } from '../server/services/TechnicalAnalysisService';
import type { RiskService } from '../server/services/RiskService';
import type { MarketEventService } from '../server/services/MarketEventService';
import type { SymbolMapper } from '../server/services/SymbolMapper';

// =============================================================================
// Mock Response Helper
// =============================================================================

/** Mock Response type with typed json() method */
export type MockResponse<T> = Omit<Response, 'json'> & {
  json: () => Promise<T>;
};

/**
 * Helper to create a mock fetch Response for API calls.
 * Creates a Response-like object that can be used with mockFetch.mockResolvedValue().
 */
export function mockFetchResponse<T>(
  data: T,
  options: { ok?: boolean; status?: number } = {},
): MockResponse<T> {
  const { ok = true, status = 200 } = options;
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  } as MockResponse<T>;
}

// =============================================================================
// Mock Type Helper
// =============================================================================

// Type helper for creating properly typed mocks
// Uses conditional types to extract function signatures for Jest 29+
type MockedService<T> = {
  [K in keyof T]: T[K] extends (...args: infer _A) => infer _R
    ? jest.MockedFunction<T[K]>
    : never;
};

// =============================================================================
// TradeRepublicApiService Mock
// =============================================================================

export const mockTradeRepublicApiService = {
  connect: jest.fn<TradeRepublicApiService['connect']>(),
  enterTwoFactorCode: jest.fn<TradeRepublicApiService['enterTwoFactorCode']>(),
  subscribe: jest.fn<TradeRepublicApiService['subscribe']>(),
  unsubscribe: jest.fn<TradeRepublicApiService['unsubscribe']>(),
  getAuthStatus: jest.fn<TradeRepublicApiService['getAuthStatus']>(),
  validateSession: jest.fn<TradeRepublicApiService['validateSession']>(),
  subscribeAndWait: jest.fn<TradeRepublicApiService['subscribeAndWait']>(),
  disconnect: jest.fn<TradeRepublicApiService['disconnect']>(),
  onMessage: jest.fn<TradeRepublicApiService['onMessage']>(),
  onError: jest.fn<TradeRepublicApiService['onError']>(),
  offMessage: jest.fn<TradeRepublicApiService['offMessage']>(),
  offError: jest.fn<TradeRepublicApiService['offError']>(),
} as MockedService<TradeRepublicApiService>;

// =============================================================================
// MarketDataService Mock
// =============================================================================

export const mockMarketDataService = {
  getPrice: jest.fn<MarketDataService['getPrice']>(),
  getPriceHistory: jest.fn<MarketDataService['getPriceHistory']>(),
  getOrderBook: jest.fn<MarketDataService['getOrderBook']>(),
  searchAssets: jest.fn<MarketDataService['searchAssets']>(),
  getAssetInfo: jest.fn<MarketDataService['getAssetInfo']>(),
  getMarketStatus: jest.fn<MarketDataService['getMarketStatus']>(),
  waitForMarket: jest.fn<MarketDataService['waitForMarket']>(),
} as MockedService<MarketDataService>;

// =============================================================================
// OrderService Mock
// =============================================================================

export const mockOrderService = {
  placeOrder: jest.fn<OrderService['placeOrder']>(),
  getOrders: jest.fn<OrderService['getOrders']>(),
  modifyOrder: jest.fn<OrderService['modifyOrder']>(),
  cancelOrder: jest.fn<OrderService['cancelOrder']>(),
} as MockedService<OrderService>;

// =============================================================================
// PortfolioService Mock
// =============================================================================

export const mockPortfolioService = {
  getPortfolio: jest.fn<PortfolioService['getPortfolio']>(),
  getCashBalance: jest.fn<PortfolioService['getCashBalance']>(),
} as MockedService<PortfolioService>;

// =============================================================================
// NewsService Mock
// =============================================================================

export const mockNewsService = {
  getNews: jest.fn<NewsService['getNews']>(),
} as MockedService<NewsService>;

// =============================================================================
// SentimentService Mock
// =============================================================================

export const mockSentimentService = {
  getSentiment: jest.fn<SentimentService['getSentiment']>(),
} as MockedService<SentimentService>;

// =============================================================================
// FundamentalsService Mock
// =============================================================================

export const mockFundamentalsService = {
  getFundamentals: jest.fn<FundamentalsService['getFundamentals']>(),
} as MockedService<FundamentalsService>;

// =============================================================================
// TechnicalAnalysisService Mock
// =============================================================================

export const mockTechnicalAnalysisService = {
  getIndicators: jest.fn<TechnicalAnalysisService['getIndicators']>(),
  getDetailedAnalysis:
    jest.fn<TechnicalAnalysisService['getDetailedAnalysis']>(),
} as MockedService<TechnicalAnalysisService>;

// =============================================================================
// RiskService Mock
// =============================================================================

export const mockRiskService = {
  calculatePositionSize: jest.fn<RiskService['calculatePositionSize']>(),
  getRiskMetrics: jest.fn<RiskService['getRiskMetrics']>(),
} as MockedService<RiskService>;

// =============================================================================
// MarketEventService Mock
// =============================================================================

export const mockMarketEventService = {
  waitForMarketEvent: jest.fn<MarketEventService['waitForMarketEvent']>(),
} as MockedService<MarketEventService>;

// =============================================================================
// SymbolMapper Mock
// =============================================================================

const mockSymbolMapper = {
  isinToSymbol: jest.fn<SymbolMapper['isinToSymbol']>(),
  clearCache: jest.fn<SymbolMapper['clearCache']>(),
} as MockedService<SymbolMapper>;

// =============================================================================
// Mock Services Setup Function
// =============================================================================

/**
 * Sets up jest.mock() for all services.
 * Call this before importing the module under test.
 */
export function mockServices(): void {
  jest.mock('../server/services/TradeRepublicApiService', () => ({
    TradeRepublicApiService: jest
      .fn()
      .mockImplementation(() => mockTradeRepublicApiService),
  }));

  jest.mock('../server/services/PortfolioService', () => ({
    PortfolioService: jest.fn().mockImplementation(() => mockPortfolioService),
  }));

  jest.mock('../server/services/MarketDataService', () => ({
    MarketDataService: jest
      .fn()
      .mockImplementation(() => mockMarketDataService),
  }));

  jest.mock('../server/services/OrderService', () => ({
    OrderService: jest.fn().mockImplementation(() => mockOrderService),
  }));

  jest.mock('../server/services/TechnicalAnalysisService', () => ({
    TechnicalAnalysisService: jest
      .fn()
      .mockImplementation(() => mockTechnicalAnalysisService),
  }));

  jest.mock('../server/services/MarketEventService', () => ({
    MarketEventService: jest
      .fn()
      .mockImplementation(() => mockMarketEventService),
  }));

  jest.mock('../server/services/NewsService', () => ({
    NewsService: jest.fn().mockImplementation(() => mockNewsService),
  }));

  jest.mock('../server/services/SentimentService', () => ({
    SentimentService: jest.fn().mockImplementation(() => mockSentimentService),
  }));

  jest.mock('../server/services/FundamentalsService', () => ({
    FundamentalsService: jest
      .fn()
      .mockImplementation(() => mockFundamentalsService),
  }));

  jest.mock('../server/services/RiskService', () => ({
    RiskService: jest.fn().mockImplementation(() => mockRiskService),
  }));

  jest.mock('../server/services/SymbolMapper', () => ({
    SymbolMapper: jest.fn().mockImplementation(() => mockSymbolMapper),
  }));
}
