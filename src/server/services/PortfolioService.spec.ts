/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { PortfolioService } from './PortfolioService';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  TradeRepublicError,
} from './TradeRepublicApiService.types';
import {
  GetPortfolioResponseSchema,
  GetCashBalanceResponseSchema,
} from './PortfolioService.response';

/**
 * Creates a mock TradeRepublicApiService for testing.
 */
function createMockApiService(): jest.Mocked<TradeRepublicApiService> {
  return {
    getAuthStatus: jest
      .fn<() => AuthStatus>()
      .mockReturnValue(AuthStatus.AUTHENTICATED),
    subscribeAndWait: jest
      .fn<
        <T>(
          topic: string,
          payload: Record<string, unknown>,
          schema: { safeParse: (data: unknown) => unknown },
          timeoutMs?: number,
        ) => Promise<T>
      >()
      .mockResolvedValue({} as never),
  } as unknown as jest.Mocked<TradeRepublicApiService>;
}

describe('PortfolioService.response', () => {
  describe('GetPortfolioResponseSchema', () => {
    it('should transform netSize from string to number', () => {
      const data = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: '10.5',
            netValue: 1050,
          },
        ],
        netValue: 1050,
      };

      const result = GetPortfolioResponseSchema.parse(data);

      expect(result.positions[0].netSize).toBe(10.5);
    });

    it('should use averageBuyIn for averageCost', () => {
      const data = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            averageBuyIn: 95,
          },
        ],
        netValue: 1000,
      };

      const result = GetPortfolioResponseSchema.parse(data);

      expect(result.positions[0].averageCost).toBe(95);
    });

    it('should use unrealisedAverageCost for averageCost when averageBuyIn is missing', () => {
      const data = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            unrealisedAverageCost: 90,
          },
        ],
        netValue: 1000,
      };

      const result = GetPortfolioResponseSchema.parse(data);

      expect(result.positions[0].averageCost).toBe(90);
    });

    it('should default averageCost to 0 when neither field is present', () => {
      const data = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
          },
        ],
        netValue: 1000,
      };

      const result = GetPortfolioResponseSchema.parse(data);

      expect(result.positions[0].averageCost).toBe(0);
    });

    it('should default realisedProfit to 0 when missing', () => {
      const data = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
          },
        ],
        netValue: 1000,
      };

      const result = GetPortfolioResponseSchema.parse(data);

      expect(result.positions[0].realisedProfit).toBe(0);
    });
  });

  describe('GetCashBalanceResponseSchema', () => {
    it('should transform amount to availableCash', () => {
      const data = { amount: 1000, currencyId: 'EUR' };

      const result = GetCashBalanceResponseSchema.parse(data);

      expect(result.availableCash).toBe(1000);
    });

    it('should use availableCash when amount is missing', () => {
      const data = { availableCash: 2000, currency: 'USD' };

      const result = GetCashBalanceResponseSchema.parse(data);

      expect(result.availableCash).toBe(2000);
    });

    it('should default availableCash to 0 when missing', () => {
      const data = {};

      const result = GetCashBalanceResponseSchema.parse(data);

      expect(result.availableCash).toBe(0);
    });

    it('should transform currencyId to currency', () => {
      const data = { amount: 1000, currencyId: 'EUR' };

      const result = GetCashBalanceResponseSchema.parse(data);

      expect(result.currency).toBe('EUR');
    });

    it('should use currency when currencyId is missing', () => {
      const data = { amount: 1000, currency: 'USD' };

      const result = GetCashBalanceResponseSchema.parse(data);

      expect(result.currency).toBe('USD');
    });

    it('should default currency to EUR when missing', () => {
      const data = { amount: 1000 };

      const result = GetCashBalanceResponseSchema.parse(data);

      expect(result.currency).toBe('EUR');
    });
  });
});

describe('PortfolioService', () => {
  let mockApi: jest.Mocked<TradeRepublicApiService>;
  let service: PortfolioService;
  const CUSTOM_TIMEOUT = 5000;

  beforeEach(() => {
    mockApi = createMockApiService();
    service = new PortfolioService(mockApi, CUSTOM_TIMEOUT);
  });

  describe('getPortfolio', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.getPortfolio()).rejects.toThrow(TradeRepublicError);
      await expect(service.getPortfolio()).rejects.toThrow('Not authenticated');
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            averageBuyIn: 95,
          },
        ],
        netValue: 1000,
      };
      mockApi.subscribeAndWait.mockResolvedValue(portfolioData);

      await service.getPortfolio();

      expect(mockApi.subscribeAndWait).toHaveBeenCalledWith(
        'compactPortfolio',
        {},
        GetPortfolioResponseSchema,
        CUSTOM_TIMEOUT,
      );
    });

    it('should return the portfolio data from subscribeAndWait', async () => {
      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            averageCost: 95,
          },
        ],
        netValue: 1000,
      };
      mockApi.subscribeAndWait.mockResolvedValue(portfolioData);

      const result = await service.getPortfolio();

      expect(result).toEqual(portfolioData);
    });

    it('should propagate errors from subscribeAndWait', async () => {
      mockApi.subscribeAndWait.mockRejectedValue(
        new TradeRepublicError('compactPortfolio request timed out'),
      );

      await expect(service.getPortfolio()).rejects.toThrow(
        'compactPortfolio request timed out',
      );
    });

    it('should log the request', async () => {
      mockApi.subscribeAndWait.mockResolvedValue({
        positions: [],
        netValue: 0,
      });

      await service.getPortfolio();

      expect(logger.api.info).toHaveBeenCalledWith('Requesting portfolio data');
    });
  });

  describe('getCashBalance', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.getCashBalance()).rejects.toThrow(
        TradeRepublicError,
      );
      await expect(service.getCashBalance()).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('should call subscribeAndWait with correct parameters', async () => {
      const cashData = { availableCash: 1000, currency: 'EUR' };
      mockApi.subscribeAndWait.mockResolvedValue(cashData);

      await service.getCashBalance();

      expect(mockApi.subscribeAndWait).toHaveBeenCalledWith(
        'cash',
        {},
        GetCashBalanceResponseSchema,
        CUSTOM_TIMEOUT,
      );
    });

    it('should return the cash balance data from subscribeAndWait', async () => {
      const cashData = { availableCash: 2500.5, currency: 'EUR' };
      mockApi.subscribeAndWait.mockResolvedValue(cashData);

      const result = await service.getCashBalance();

      expect(result).toEqual(cashData);
    });

    it('should propagate errors from subscribeAndWait', async () => {
      mockApi.subscribeAndWait.mockRejectedValue(
        new TradeRepublicError('cash request timed out'),
      );

      await expect(service.getCashBalance()).rejects.toThrow(
        'cash request timed out',
      );
    });

    it('should log the request', async () => {
      mockApi.subscribeAndWait.mockResolvedValue({
        availableCash: 0,
        currency: 'EUR',
      });

      await service.getCashBalance();

      expect(logger.api.info).toHaveBeenCalledWith(
        'Requesting cash balance data',
      );
    });
  });
});
