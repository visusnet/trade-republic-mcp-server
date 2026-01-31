/**
 * Fundamentals Service - Types and Errors
 */

/**
 * Error class for fundamentals service operations.
 */
export class FundamentalsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FundamentalsServiceError';
  }
}

/**
 * Yahoo Finance quoteSummary module options.
 */
export type YahooQuoteSummaryModule =
  | 'assetProfile'
  | 'financialData'
  | 'defaultKeyStatistics'
  | 'summaryDetail'
  | 'calendarEvents'
  | 'recommendationTrend'
  | 'price';

/**
 * Subset of Yahoo Finance quoteSummary result.
 */
export interface YahooQuoteSummaryResult {
  assetProfile?: {
    longBusinessSummary?: string;
    sector?: string;
    industry?: string;
    country?: string;
    website?: string;
    fullTimeEmployees?: number;
  };
  financialData?: {
    totalRevenue?: number;
    grossMargins?: number;
    operatingMargins?: number;
    profitMargins?: number;
    freeCashflow?: number;
    totalDebt?: number;
    totalCash?: number;
    debtToEquity?: number;
    currentRatio?: number;
    targetMeanPrice?: number;
    numberOfAnalystOpinions?: number;
    recommendationKey?: string;
  };
  defaultKeyStatistics?: {
    trailingEps?: number;
    forwardEps?: number;
    pegRatio?: number;
    enterpriseValue?: number;
    enterpriseToRevenue?: number;
    enterpriseToEbitda?: number;
    earningsQuarterlyGrowth?: number;
  };
  summaryDetail?: {
    marketCap?: number;
    trailingPE?: number;
    forwardPE?: number;
    priceToBook?: number;
    priceToSalesTrailing12Months?: number;
  };
  calendarEvents?: {
    earnings?: {
      earningsDate?: Array<{ raw: number }>;
    };
  };
  recommendationTrend?: {
    trend?: Array<{
      strongBuy?: number;
      buy?: number;
      hold?: number;
      sell?: number;
      strongSell?: number;
    }>;
  };
  price?: {
    shortName?: string;
    longName?: string;
  };
}

/**
 * Interface for Yahoo Finance quoteSummary function.
 */
export interface YahooQuoteSummaryFn {
  (
    symbol: string,
    options: { modules: YahooQuoteSummaryModule[] },
  ): Promise<YahooQuoteSummaryResult>;
}
