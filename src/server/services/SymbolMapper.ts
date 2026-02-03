/**
 * Symbol Mapper Service
 *
 * Maps ISINs to Yahoo Finance symbols with caching.
 */

import { z } from 'zod';
import YahooFinance from 'yahoo-finance2';
import type { SearchResult } from 'yahoo-finance2/modules/search';

import { logger } from '../../logger';

/**
 * Error class for symbol mapping operations.
 */
export class SymbolMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SymbolMapperError';
  }
}

/**
 * ISIN format validation schema.
 * Format: 2 letter country code + 9 alphanumeric + 1 check digit
 */
export const IsinSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{10}$/);

/**
 * Maps ISINs to Yahoo Finance symbols.
 */
export class SymbolMapper {
  private readonly cache: Map<string, string> = new Map();

  /**
   * Convert an ISIN to a Yahoo Finance symbol.
   * @param isin - The ISIN to convert
   * @returns The Yahoo Finance symbol
   * @throws SymbolMapperError if ISIN is invalid or no symbol is found
   */
  public async isinToSymbol(isin: string): Promise<string> {
    const parseResult = IsinSchema.safeParse(isin);
    if (!parseResult.success) {
      throw new SymbolMapperError('Invalid ISIN format');
    }

    const cached = this.cache.get(isin);
    if (cached) {
      logger.api.debug({ isin, symbol: cached }, 'Cache hit for ISIN');
      return cached;
    }

    logger.api.info({ isin }, 'Searching Yahoo Finance for symbol');

    let result: SearchResult;
    try {
      result = await new YahooFinance().search(isin);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SymbolMapperError(`Failed to search for symbol: ${message}`);
    }

    // Find a Yahoo Finance quote (has symbol property, isYahooFinance: true)
    const quote = result.quotes.find((q) => 'symbol' in q && q.isYahooFinance);
    if (!quote || !('symbol' in quote)) {
      throw new SymbolMapperError(`No Yahoo symbol found for ISIN: ${isin}`);
    }

    this.cache.set(isin, quote.symbol);
    logger.api.debug({ isin, symbol: quote.symbol }, 'Cached ISIN to symbol');

    return quote.symbol;
  }

  /**
   * Clear the ISIN to symbol cache.
   */
  public clearCache(): void {
    this.cache.clear();
    logger.api.debug('Symbol mapper cache cleared');
  }
}
