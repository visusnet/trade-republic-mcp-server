/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';
import type { YahooQuoteSummaryResult } from './FundamentalsService.types';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

const mockQuoteSummary =
  jest.fn<
    (
      symbol: string,
      options: { modules: string[] },
    ) => Promise<YahooQuoteSummaryResult>
  >();

// Mock yahoo-finance2 module - mock as a class constructor
jest.mock('yahoo-finance2', () => ({
  __esModule: true,
  default: class MockYahooFinance {
    quoteSummary = mockQuoteSummary;
  },
}));

import { FundamentalsService } from './FundamentalsService';
import { FundamentalsServiceError } from './FundamentalsService.types';
import type { SymbolMapper } from './SymbolMapper';
import type { GetFundamentalsRequest } from './FundamentalsService.request';

describe('FundamentalsService', () => {
  let service: FundamentalsService;
  let mockSymbolMapper: jest.Mocked<SymbolMapper>;

  beforeEach(() => {
    mockSymbolMapper = {
      isinToSymbol: jest.fn(),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<SymbolMapper>;

    mockQuoteSummary.mockReset();

    service = new FundamentalsService(mockSymbolMapper);
  });

  describe('getFundamentals', () => {
    const validRequest: GetFundamentalsRequest = {
      isin: 'US0378331005',
      modules: ['profile', 'financials', 'valuation'],
    };

    it('should return fundamentals for valid ISIN', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        assetProfile: {
          sector: 'Technology',
          industry: 'Consumer Electronics',
          country: 'United States',
          website: 'https://apple.com',
          fullTimeEmployees: 164000,
          longBusinessSummary: 'Apple Inc. designs and sells electronics.',
        },
        price: {
          shortName: 'Apple Inc.',
        },
      });

      const result = await service.getFundamentals(validRequest);

      expect(result.isin).toBe('US0378331005');
      expect(result.symbol).toBe('AAPL');
      expect(result.profile).toBeDefined();
      expect(result.profile?.sector).toBe('Technology');
    });

    it('should call symbolMapper with ISIN', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({});

      await service.getFundamentals(validRequest);

      expect(mockSymbolMapper.isinToSymbol).toHaveBeenCalledWith(
        'US0378331005',
      );
    });

    it('should call quoteSummary with correct modules', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({});

      await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['profile', 'financials'],
      });

      expect(mockQuoteSummary).toHaveBeenCalledWith('AAPL', {
        modules: expect.arrayContaining([
          'assetProfile',
          'financialData',
          'price',
        ]),
      });
    });

    it('should use default modules when not provided', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({});

      await service.getFundamentals({ isin: 'US0378331005' });

      expect(mockQuoteSummary).toHaveBeenCalledWith('AAPL', {
        modules: expect.arrayContaining([
          'assetProfile',
          'financialData',
          'summaryDetail',
          'price',
        ]),
      });
    });

    it('should throw FundamentalsServiceError when symbolMapper fails', async () => {
      mockSymbolMapper.isinToSymbol.mockRejectedValue(
        new Error('No symbol found'),
      );

      await expect(service.getFundamentals(validRequest)).rejects.toThrow(
        FundamentalsServiceError,
      );
      await expect(service.getFundamentals(validRequest)).rejects.toThrow(
        'Failed to get fundamentals: No symbol found',
      );
    });

    it('should throw FundamentalsServiceError when quoteSummary fails', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockRejectedValue(new Error('Network error'));

      await expect(service.getFundamentals(validRequest)).rejects.toThrow(
        FundamentalsServiceError,
      );
      await expect(service.getFundamentals(validRequest)).rejects.toThrow(
        'Failed to get fundamentals: Network error',
      );
    });

    it('should handle non-Error thrown from dependencies', async () => {
      mockSymbolMapper.isinToSymbol.mockRejectedValue('String error');

      await expect(service.getFundamentals(validRequest)).rejects.toThrow(
        'Failed to get fundamentals: String error',
      );
    });

    it('should include timestamp in response', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({});

      const result = await service.getFundamentals(validRequest);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('profile module', () => {
    it('should extract profile data', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        assetProfile: {
          sector: 'Technology',
          industry: 'Consumer Electronics',
          country: 'United States',
          website: 'https://apple.com',
          fullTimeEmployees: 164000,
          longBusinessSummary: 'Apple Inc. designs and sells electronics.',
        },
        price: {
          longName: 'Apple Inc.',
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['profile'],
      });

      expect(result.profile).toEqual({
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        country: 'United States',
        website: 'https://apple.com',
        employees: 164000,
        description: 'Apple Inc. designs and sells electronics.',
      });
    });

    it('should use shortName if longName not available', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        assetProfile: {},
        price: {
          shortName: 'Apple Inc.',
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['profile'],
      });

      expect(result.profile?.name).toBe('Apple Inc.');
    });

    it('should handle missing assetProfile', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({});

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['profile'],
      });

      expect(result.profile).toEqual({});
    });
  });

  describe('financials module', () => {
    it('should extract financials data', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        financialData: {
          totalRevenue: 394328000000,
          grossMargins: 0.4331,
          operatingMargins: 0.3029,
          profitMargins: 0.2531,
          freeCashflow: 90215000000,
          totalDebt: 111000000000,
          totalCash: 62482000000,
          debtToEquity: 181.04,
          currentRatio: 0.988,
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['financials'],
      });

      expect(result.financials).toEqual({
        revenue: 394328000000,
        grossMargin: 0.4331,
        operatingMargin: 0.3029,
        profitMargin: 0.2531,
        freeCashFlow: 90215000000,
        totalDebt: 111000000000,
        totalCash: 62482000000,
        debtToEquity: 181.04,
        currentRatio: 0.988,
      });
    });

    it('should handle missing financialData', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({});

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['financials'],
      });

      expect(result.financials).toEqual({});
    });

    it('should handle partial financialData', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        financialData: {
          totalRevenue: 394328000000,
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['financials'],
      });

      expect(result.financials?.revenue).toBe(394328000000);
      expect(result.financials?.grossMargin).toBeUndefined();
    });
  });

  describe('earnings module', () => {
    it('should extract earnings data', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        defaultKeyStatistics: {
          trailingEps: 6.13,
          forwardEps: 7.02,
          earningsQuarterlyGrowth: 0.105,
        },
        calendarEvents: {
          earnings: {
            earningsDate: [{ raw: 1706745600 }],
          },
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['earnings'],
      });

      expect(result.earnings).toEqual({
        eps: 6.13,
        epsTTM: 6.13,
        epsGrowth: expect.any(Number),
        nextEarningsDate: '2024-02-01T00:00:00.000Z',
        earningsQuarterlyGrowth: 0.105,
      });
    });

    it('should handle missing calendarEvents', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        defaultKeyStatistics: {
          trailingEps: 6.13,
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['earnings'],
      });

      expect(result.earnings?.eps).toBe(6.13);
      expect(result.earnings?.nextEarningsDate).toBeUndefined();
    });

    it('should handle empty earnings dates array', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        calendarEvents: {
          earnings: {
            earningsDate: [],
          },
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['earnings'],
      });

      expect(result.earnings?.nextEarningsDate).toBeUndefined();
    });

    it('should calculate EPS growth when both trailing and forward available', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        defaultKeyStatistics: {
          trailingEps: 5.0,
          forwardEps: 6.0,
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['earnings'],
      });

      expect(result.earnings?.epsGrowth).toBeCloseTo(0.2, 2);
    });
  });

  describe('valuation module', () => {
    it('should extract valuation data', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        summaryDetail: {
          marketCap: 2890000000000,
          trailingPE: 29.5,
          forwardPE: 26.2,
          priceToBook: 47.5,
          priceToSalesTrailing12Months: 7.3,
        },
        defaultKeyStatistics: {
          pegRatio: 2.45,
          enterpriseValue: 2950000000000,
          enterpriseToRevenue: 7.5,
          enterpriseToEbitda: 22.1,
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['valuation'],
      });

      expect(result.valuation).toEqual({
        marketCap: 2890000000000,
        peRatio: 29.5,
        forwardPE: 26.2,
        pegRatio: 2.45,
        priceToBook: 47.5,
        priceToSales: 7.3,
        enterpriseValue: 2950000000000,
        evToRevenue: 7.5,
        evToEbitda: 22.1,
      });
    });

    it('should handle missing summaryDetail', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        defaultKeyStatistics: {
          pegRatio: 2.45,
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['valuation'],
      });

      expect(result.valuation?.pegRatio).toBe(2.45);
      expect(result.valuation?.marketCap).toBeUndefined();
    });
  });

  describe('recommendations module', () => {
    it('should extract recommendations data', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        financialData: {
          targetMeanPrice: 210.5,
          numberOfAnalystOpinions: 45,
          recommendationKey: 'buy',
        },
        recommendationTrend: {
          trend: [
            {
              strongBuy: 15,
              buy: 20,
              hold: 8,
              sell: 2,
              strongSell: 0,
            },
          ],
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['recommendations'],
      });

      expect(result.recommendations).toEqual({
        rating: 'buy',
        targetPrice: 210.5,
        numberOfAnalysts: 45,
        strongBuy: 15,
        buy: 20,
        hold: 8,
        sell: 2,
        strongSell: 0,
      });
    });

    it('should handle missing recommendationTrend', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        financialData: {
          recommendationKey: 'buy',
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['recommendations'],
      });

      expect(result.recommendations?.rating).toBe('buy');
      expect(result.recommendations?.strongBuy).toBeUndefined();
    });

    it('should handle empty trend array', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        recommendationTrend: {
          trend: [],
        },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['recommendations'],
      });

      expect(result.recommendations?.strongBuy).toBeUndefined();
    });
  });

  describe('all modules', () => {
    it('should fetch all modules when requested', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        assetProfile: { sector: 'Technology' },
        financialData: { totalRevenue: 100 },
        defaultKeyStatistics: { trailingEps: 5 },
        summaryDetail: { marketCap: 1000 },
        recommendationTrend: { trend: [] },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: [
          'profile',
          'financials',
          'earnings',
          'valuation',
          'recommendations',
        ],
      });

      expect(result.profile).toBeDefined();
      expect(result.financials).toBeDefined();
      expect(result.earnings).toBeDefined();
      expect(result.valuation).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should only include requested modules in response', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockQuoteSummary.mockResolvedValue({
        assetProfile: { sector: 'Technology' },
      });

      const result = await service.getFundamentals({
        isin: 'US0378331005',
        modules: ['profile'],
      });

      expect(result.profile).toBeDefined();
      expect(result.financials).toBeUndefined();
      expect(result.earnings).toBeUndefined();
      expect(result.valuation).toBeUndefined();
      expect(result.recommendations).toBeUndefined();
    });
  });
});
