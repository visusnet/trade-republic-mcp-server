import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

const mockSearch =
  jest.fn<
    (
      query: string,
    ) => Promise<{
      quotes: Array<{ symbol?: string; isYahooFinance?: boolean }>;
    }>
  >();

// Mock yahoo-finance2 module - mock as a class constructor
jest.mock('yahoo-finance2', () => ({
  __esModule: true,
  default: class MockYahooFinance {
    search = mockSearch;
  },
}));

import { SymbolMapper, SymbolMapperError, IsinSchema } from './SymbolMapper';

describe('SymbolMapper', () => {
  let mapper: SymbolMapper;

  beforeEach(() => {
    mockSearch.mockReset();
    mapper = new SymbolMapper();
  });

  describe('IsinSchema', () => {
    it('should accept valid ISIN format', () => {
      const result = IsinSchema.safeParse('US0378331005');
      expect(result.success).toBe(true);
    });

    it('should accept valid German ISIN', () => {
      const result = IsinSchema.safeParse('DE0007164600');
      expect(result.success).toBe(true);
    });

    it('should reject invalid ISIN - too short', () => {
      const result = IsinSchema.safeParse('US037833100');
      expect(result.success).toBe(false);
    });

    it('should reject invalid ISIN - too long', () => {
      const result = IsinSchema.safeParse('US03783310055');
      expect(result.success).toBe(false);
    });

    it('should reject invalid ISIN - lowercase country code', () => {
      const result = IsinSchema.safeParse('us0378331005');
      expect(result.success).toBe(false);
    });

    it('should reject invalid ISIN - starts with number', () => {
      const result = IsinSchema.safeParse('120378331005');
      expect(result.success).toBe(false);
    });
  });

  describe('isinToSymbol', () => {
    it('should map valid ISIN to Yahoo symbol', async () => {
      mockSearch.mockResolvedValue({
        quotes: [{ symbol: 'AAPL', isYahooFinance: true }],
      });

      const symbol = await mapper.isinToSymbol('US0378331005');
      expect(symbol).toBe('AAPL');
    });

    it('should call Yahoo Finance search with ISIN', async () => {
      mockSearch.mockResolvedValue({
        quotes: [{ symbol: 'AAPL', isYahooFinance: true }],
      });

      await mapper.isinToSymbol('US0378331005');
      expect(mockSearch).toHaveBeenCalledWith('US0378331005');
    });

    it('should throw SymbolMapperError for invalid ISIN format', async () => {
      await expect(mapper.isinToSymbol('invalid')).rejects.toThrow(
        SymbolMapperError,
      );
      await expect(mapper.isinToSymbol('invalid')).rejects.toThrow(
        'Invalid ISIN format',
      );
    });

    it('should throw SymbolMapperError when no results found', async () => {
      mockSearch.mockResolvedValue({
        quotes: [],
      });

      await expect(mapper.isinToSymbol('US0000000000')).rejects.toThrow(
        SymbolMapperError,
      );
      await expect(mapper.isinToSymbol('US0000000000')).rejects.toThrow(
        'No Yahoo symbol found for ISIN: US0000000000',
      );
    });

    it('should use cache on second call', async () => {
      mockSearch.mockResolvedValue({
        quotes: [{ symbol: 'AAPL', isYahooFinance: true }],
      });

      await mapper.isinToSymbol('US0378331005');
      await mapper.isinToSymbol('US0378331005');

      expect(mockSearch).toHaveBeenCalledTimes(1);
    });

    it('should return cached symbol on second call', async () => {
      mockSearch.mockResolvedValue({
        quotes: [{ symbol: 'AAPL', isYahooFinance: true }],
      });

      const first = await mapper.isinToSymbol('US0378331005');
      const second = await mapper.isinToSymbol('US0378331005');

      expect(first).toBe('AAPL');
      expect(second).toBe('AAPL');
    });

    it('should wrap Yahoo Finance errors in SymbolMapperError', async () => {
      mockSearch.mockRejectedValue(new Error('Network error'));

      await expect(mapper.isinToSymbol('US0378331005')).rejects.toThrow(
        SymbolMapperError,
      );
      await expect(mapper.isinToSymbol('US0378331005')).rejects.toThrow(
        'Failed to search for symbol: Network error',
      );
    });

    it('should handle quotes array with no symbol field', async () => {
      mockSearch.mockResolvedValue({
        quotes: [{}],
      });

      await expect(mapper.isinToSymbol('US0378331005')).rejects.toThrow(
        'No Yahoo symbol found for ISIN: US0378331005',
      );
    });

    it('should handle non-Error thrown from search', async () => {
      mockSearch.mockRejectedValue('String error');

      await expect(mapper.isinToSymbol('US0378331005')).rejects.toThrow(
        'Failed to search for symbol: String error',
      );
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      mockSearch.mockResolvedValue({
        quotes: [{ symbol: 'AAPL', isYahooFinance: true }],
      });

      await mapper.isinToSymbol('US0378331005');
      mapper.clearCache();
      await mapper.isinToSymbol('US0378331005');

      expect(mockSearch).toHaveBeenCalledTimes(2);
    });
  });
});
