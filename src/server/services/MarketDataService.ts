/**
 * Market Data Service
 *
 * Provides methods for retrieving market data from the Trade Republic API
 * via WebSocket subscriptions: prices, price history, order book, search,
 * asset info, and market status.
 */

import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  TradeRepublicError,
} from './TradeRepublicApiService.types';
import {
  DEFAULT_EXCHANGE,
  type GetPriceRequest,
  type GetPriceHistoryRequest,
  type GetOrderBookRequest,
  type SearchAssetsRequest,
  type GetAssetInfoRequest,
  type GetMarketStatusRequest,
  type WaitForMarketRequest,
} from './MarketDataService.request';
import {
  TickerApiResponseSchema,
  AggregateHistoryApiSchema,
  NeonSearchApiSchema,
  InstrumentApiSchema,
  type GetPriceResponse,
  type GetPriceHistoryResponse,
  type GetOrderBookResponse,
  type SearchAssetsResponse,
  type GetAssetInfoResponse,
  type GetMarketStatusResponse,
  type WaitForMarketResponse,
  type MarketStatus,
} from './MarketDataService.response';

const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 30_000;
const DEFAULT_WAIT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_SEARCH_LIMIT = 10;

export class MarketDataService {
  constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
  ) {}

  /**
   * Get current price for an instrument.
   */
  public async getPrice(request: GetPriceRequest): Promise<GetPriceResponse> {
    this.ensureAuthenticated();
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;
    const tickerId = `${request.isin}.${exchange}`;

    logger.api.info({ isin: request.isin, exchange }, 'Requesting price data');

    const tickerData = await this.api.subscribeAndWait(
      'ticker',
      { id: tickerId },
      TickerApiResponseSchema,
      this.timeoutMs,
    );

    const bid = tickerData.bid.price;
    const ask = tickerData.ask.price;
    const spread = ask - bid;
    const midPrice = (bid + ask) / 2;
    const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    return {
      isin: request.isin,
      exchange,
      bid,
      ask,
      last: tickerData.last?.price,
      spread,
      spreadPercent,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get historical price data (OHLCV candles) for an instrument.
   */
  public async getPriceHistory(
    request: GetPriceHistoryRequest,
  ): Promise<GetPriceHistoryResponse> {
    this.ensureAuthenticated();
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;
    const tickerId = `${request.isin}.${exchange}`;

    logger.api.info(
      { isin: request.isin, exchange, range: request.range },
      'Requesting price history',
    );

    const historyData = await this.api.subscribeAndWait(
      'aggregateHistory',
      { id: tickerId, range: request.range },
      AggregateHistoryApiSchema,
      this.timeoutMs,
    );

    return {
      isin: request.isin,
      exchange,
      range: request.range,
      candles: historyData.aggregates.map((agg) => ({
        time: agg.time,
        open: agg.open,
        high: agg.high,
        low: agg.low,
        close: agg.close,
        volume: agg.volume,
      })),
      resolution: historyData.resolution,
    };
  }

  /**
   * Get order book (bid/ask) for an instrument.
   * Note: Trade Republic only provides top-of-book data.
   */
  public async getOrderBook(
    request: GetOrderBookRequest,
  ): Promise<GetOrderBookResponse> {
    this.ensureAuthenticated();
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;
    const tickerId = `${request.isin}.${exchange}`;

    logger.api.info({ isin: request.isin, exchange }, 'Requesting order book');

    const tickerData = await this.api.subscribeAndWait(
      'ticker',
      { id: tickerId },
      TickerApiResponseSchema,
      this.timeoutMs,
    );

    const bidPrice = tickerData.bid.price;
    const askPrice = tickerData.ask.price;
    const spread = askPrice - bidPrice;
    const midPrice = (bidPrice + askPrice) / 2;

    return {
      isin: request.isin,
      exchange,
      bids: [{ price: bidPrice, size: tickerData.bid.size }],
      asks: [{ price: askPrice, size: tickerData.ask.size }],
      spread,
      midPrice,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Search for assets by name or symbol.
   */
  public async searchAssets(
    request: SearchAssetsRequest,
  ): Promise<SearchAssetsResponse> {
    this.ensureAuthenticated();
    const limit = request.limit ?? DEFAULT_SEARCH_LIMIT;

    logger.api.info({ query: request.query, limit }, 'Searching assets');

    const searchData = await this.api.subscribeAndWait(
      'neonSearch',
      { data: { q: request.query } },
      NeonSearchApiSchema,
      this.timeoutMs,
    );

    const totalCount = searchData.results.length;
    const results = searchData.results.slice(0, limit).map((r) => ({
      isin: r.isin,
      name: r.name,
      type: r.type,
      tags: r.tags,
    }));

    return {
      results,
      totalCount,
    };
  }

  /**
   * Get detailed information about an instrument.
   */
  public async getAssetInfo(
    request: GetAssetInfoRequest,
  ): Promise<GetAssetInfoResponse> {
    this.ensureAuthenticated();

    logger.api.info({ isin: request.isin }, 'Requesting asset info');

    const instrumentData = await this.api.subscribeAndWait(
      'instrument',
      { id: request.isin },
      InstrumentApiSchema,
      this.timeoutMs,
    );

    return {
      isin: instrumentData.isin,
      name: instrumentData.name,
      shortName: instrumentData.shortName,
      symbol: instrumentData.intlSymbol ?? instrumentData.homeSymbol,
      type: instrumentData.typeId,
      wkn: instrumentData.wkn,
      company: instrumentData.company
        ? {
            name: instrumentData.company.name,
            description: instrumentData.company.description,
            country: instrumentData.company.countryOfOrigin,
          }
        : undefined,
      exchanges: instrumentData.exchanges?.map((e) => ({
        id: e.exchangeId,
        name: e.name,
      })),
      tags: instrumentData.tags?.map((t) => t.name),
    };
  }

  /**
   * Get market status for an instrument.
   * Determines if the market is open based on bid/ask availability.
   */
  public async getMarketStatus(
    request: GetMarketStatusRequest,
  ): Promise<GetMarketStatusResponse> {
    this.ensureAuthenticated();
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;
    const tickerId = `${request.isin}.${exchange}`;

    logger.api.info({ isin: request.isin, exchange }, 'Checking market status');

    const tickerData = await this.api.subscribeAndWait(
      'ticker',
      { id: tickerId },
      TickerApiResponseSchema,
      this.timeoutMs,
    );

    const hasBid = tickerData.bid.price > 0;
    const hasAsk = tickerData.ask.price > 0;
    const isOpen = hasBid && hasAsk;

    let status: MarketStatus;
    if (isOpen) {
      status = 'open';
    } else if (tickerData.pre?.price && tickerData.pre.price > 0) {
      status = 'pre-market';
    } else {
      status = 'closed';
    }

    return {
      isin: request.isin,
      exchange,
      status,
      isOpen,
      hasBid,
      hasAsk,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Wait for the market to open for an instrument.
   * Polls the market status until it's open or timeout is reached.
   */
  public async waitForMarket(
    request: WaitForMarketRequest,
  ): Promise<WaitForMarketResponse> {
    this.ensureAuthenticated();
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;
    const timeoutMs = request.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const pollIntervalMs = request.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    logger.api.info(
      { isin: request.isin, exchange, timeoutMs, pollIntervalMs },
      'Waiting for market to open',
    );

    const startTime = Date.now();
    let isOpen = false;
    let timedOut = false;

    while (!isOpen && !timedOut) {
      try {
        const status = await this.getMarketStatus({
          isin: request.isin,
          exchange,
        });
        isOpen = status.isOpen;
      } catch (error) {
        // Log and continue polling on errors
        logger.api.warn(
          { err: error },
          'Error checking market status, retrying',
        );
      }

      if (!isOpen) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeoutMs) {
          timedOut = true;
        } else {
          await this.sleep(pollIntervalMs);
        }
      }
    }

    const waitedMs = Date.now() - startTime;

    return {
      isin: request.isin,
      exchange,
      isOpen,
      waitedMs,
      timedOut,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Ensure the API service is authenticated.
   */
  private ensureAuthenticated(): void {
    if (this.api.getAuthStatus() !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
