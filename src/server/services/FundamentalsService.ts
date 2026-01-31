/**
 * Fundamentals Service
 *
 * Fetches fundamental data for instruments using Yahoo Finance.
 */

import yahooFinance from 'yahoo-finance2';

import { logger } from '../../logger';
import type { SymbolMapper } from './SymbolMapper';
import type {
  GetFundamentalsRequest,
  FundamentalsModule,
} from './FundamentalsService.request';
import type {
  GetFundamentalsResponse,
  ProfileData,
  FinancialsData,
  EarningsData,
  ValuationData,
  Recommendation,
} from './FundamentalsService.response';
import {
  FundamentalsServiceError,
  type YahooQuoteSummaryFn,
  type YahooQuoteSummaryModule,
  type YahooQuoteSummaryResult,
} from './FundamentalsService.types';

const DEFAULT_MODULES: FundamentalsModule[] = [
  'profile',
  'financials',
  'valuation',
];

/**
 * Maps our module names to Yahoo Finance module names.
 */
const MODULE_MAP: Record<FundamentalsModule, YahooQuoteSummaryModule[]> = {
  profile: ['assetProfile', 'price'],
  financials: ['financialData'],
  earnings: ['defaultKeyStatistics', 'calendarEvents'],
  valuation: ['summaryDetail', 'defaultKeyStatistics'],
  recommendations: ['financialData', 'recommendationTrend'],
};

/**
 * Default implementation using yahoo-finance2.
 */
/* istanbul ignore next -- @preserve Untestable without network calls */
function createDefaultQuoteSummary(): YahooQuoteSummaryFn {
  return (symbol: string, options: { modules: YahooQuoteSummaryModule[] }) =>
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    yahooFinance.quoteSummary(symbol, options);
}

/**
 * Dependencies for FundamentalsService.
 */
export interface FundamentalsServiceDependencies {
  symbolMapper: SymbolMapper;
  quoteSummaryFn?: YahooQuoteSummaryFn;
}

/**
 * Service for fetching fundamental data.
 */
export class FundamentalsService {
  private readonly symbolMapper: SymbolMapper;
  private readonly quoteSummaryFn: YahooQuoteSummaryFn;

  constructor(deps: FundamentalsServiceDependencies) {
    this.symbolMapper = deps.symbolMapper;
    this.quoteSummaryFn = deps.quoteSummaryFn ?? createDefaultQuoteSummary();
  }

  /**
   * Get fundamental data for an instrument.
   * @param request - The fundamentals request
   * @returns Fundamental data for the instrument
   * @throws FundamentalsServiceError if fetching fundamentals fails
   */
  public async getFundamentals(
    request: GetFundamentalsRequest,
  ): Promise<GetFundamentalsResponse> {
    const modules = request.modules ?? DEFAULT_MODULES;

    logger.api.info({ isin: request.isin, modules }, 'Fetching fundamentals');

    let symbol: string;
    let data: YahooQuoteSummaryResult;

    try {
      symbol = await this.symbolMapper.isinToSymbol(request.isin);

      const yahooModules = this.getYahooModules(modules);
      data = await this.quoteSummaryFn(symbol, { modules: yahooModules });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new FundamentalsServiceError(
        `Failed to get fundamentals: ${message}`,
      );
    }

    const response: GetFundamentalsResponse = {
      isin: request.isin,
      symbol,
      timestamp: new Date().toISOString(),
    };

    if (modules.includes('profile')) {
      response.profile = this.extractProfile(data);
    }

    if (modules.includes('financials')) {
      response.financials = this.extractFinancials(data);
    }

    if (modules.includes('earnings')) {
      response.earnings = this.extractEarnings(data);
    }

    if (modules.includes('valuation')) {
      response.valuation = this.extractValuation(data);
    }

    if (modules.includes('recommendations')) {
      response.recommendations = this.extractRecommendations(data);
    }

    logger.api.debug(
      { isin: request.isin, symbol, modules },
      'Fetched fundamentals',
    );

    return response;
  }

  private getYahooModules(
    modules: FundamentalsModule[],
  ): YahooQuoteSummaryModule[] {
    const yahooModules = new Set<YahooQuoteSummaryModule>();

    for (const module of modules) {
      const mappedModules = MODULE_MAP[module];
      for (const m of mappedModules) {
        yahooModules.add(m);
      }
    }

    // Always include price for name
    yahooModules.add('price');

    return Array.from(yahooModules);
  }

  private extractProfile(data: YahooQuoteSummaryResult): ProfileData {
    const profile = data.assetProfile;
    const price = data.price;

    if (!profile) {
      return {};
    }

    return {
      name: price?.longName ?? price?.shortName,
      sector: profile.sector,
      industry: profile.industry,
      country: profile.country,
      website: profile.website,
      employees: profile.fullTimeEmployees,
      description: profile.longBusinessSummary,
    };
  }

  private extractFinancials(data: YahooQuoteSummaryResult): FinancialsData {
    const financials = data.financialData;

    if (!financials) {
      return {};
    }

    return {
      revenue: financials.totalRevenue,
      grossMargin: financials.grossMargins,
      operatingMargin: financials.operatingMargins,
      profitMargin: financials.profitMargins,
      freeCashFlow: financials.freeCashflow,
      totalDebt: financials.totalDebt,
      totalCash: financials.totalCash,
      debtToEquity: financials.debtToEquity,
      currentRatio: financials.currentRatio,
    };
  }

  private extractEarnings(data: YahooQuoteSummaryResult): EarningsData {
    const stats = data.defaultKeyStatistics;
    const calendar = data.calendarEvents;

    const result: EarningsData = {};

    if (stats) {
      result.eps = stats.trailingEps;
      result.epsTTM = stats.trailingEps;
      result.earningsQuarterlyGrowth = stats.earningsQuarterlyGrowth;

      if (stats.trailingEps && stats.forwardEps) {
        result.epsGrowth =
          (stats.forwardEps - stats.trailingEps) / stats.trailingEps;
      }
    }

    const earningsDate = calendar?.earnings?.earningsDate?.[0];
    if (earningsDate) {
      result.nextEarningsDate = new Date(earningsDate.raw * 1000).toISOString();
    }

    return result;
  }

  private extractValuation(data: YahooQuoteSummaryResult): ValuationData {
    const summary = data.summaryDetail;
    const stats = data.defaultKeyStatistics;

    const result: ValuationData = {};

    if (summary) {
      result.marketCap = summary.marketCap;
      result.peRatio = summary.trailingPE;
      result.forwardPE = summary.forwardPE;
      result.priceToBook = summary.priceToBook;
      result.priceToSales = summary.priceToSalesTrailing12Months;
    }

    if (stats) {
      result.pegRatio = stats.pegRatio;
      result.enterpriseValue = stats.enterpriseValue;
      result.evToRevenue = stats.enterpriseToRevenue;
      result.evToEbitda = stats.enterpriseToEbitda;
    }

    return result;
  }

  private extractRecommendations(
    data: YahooQuoteSummaryResult,
  ): Recommendation {
    const financials = data.financialData;
    const trend = data.recommendationTrend?.trend?.[0];

    const result: Recommendation = {};

    if (financials) {
      result.rating = financials.recommendationKey;
      result.targetPrice = financials.targetMeanPrice;
      result.numberOfAnalysts = financials.numberOfAnalystOpinions;
    }

    if (trend) {
      result.strongBuy = trend.strongBuy;
      result.buy = trend.buy;
      result.hold = trend.hold;
      result.sell = trend.sell;
      result.strongSell = trend.strongSell;
    }

    return result;
  }
}
