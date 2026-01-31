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
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
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

    const tickerData = await this.subscribeAndWait(
      'ticker',
      { id: tickerId },
      TickerApiResponseSchema,
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

    const historyData = await this.subscribeAndWait(
      'aggregateHistory',
      { id: tickerId, range: request.range },
      AggregateHistoryApiSchema,
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

    const tickerData = await this.subscribeAndWait(
      'ticker',
      { id: tickerId },
      TickerApiResponseSchema,
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

    const searchData = await this.subscribeAndWait(
      'neonSearch',
      { data: { q: request.query } },
      NeonSearchApiSchema,
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

    const instrumentData = await this.subscribeAndWait(
      'instrument',
      { id: request.isin },
      InstrumentApiSchema,
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

    const tickerData = await this.subscribeAndWait(
      'ticker',
      { id: tickerId },
      TickerApiResponseSchema,
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
   * Subscribe to a WebSocket topic and wait for a response.
   */
  private subscribeAndWait<T>(
    topic: string,
    payload: Record<string, unknown>,
    schema: {
      safeParse: (
        data: unknown,
      ) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let subscriptionId: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      let resolved = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.api.offMessage(messageHandler);
        this.api.offError(errorHandler);
        if (subscriptionId !== null) {
          try {
            this.api.unsubscribe(subscriptionId);
          } catch {
            // Ignore unsubscribe errors during cleanup
          }
        }
      };

      const messageHandler = (message: WebSocketMessage): void => {
        if (resolved || message.id !== subscriptionId) {
          return;
        }

        if (message.code === MESSAGE_CODE.E) {
          resolved = true;
          cleanup();
          const errorPayload = message.payload as
            | { message?: string }
            | undefined;
          const errorMessage = errorPayload?.message || 'API error';
          logger.api.error(
            { payload: message.payload },
            `${topic} subscription error`,
          );
          reject(new TradeRepublicError(errorMessage));
          return;
        }

        if (message.code === MESSAGE_CODE.A) {
          resolved = true;
          cleanup();
          const parseResult = schema.safeParse(message.payload);
          if (parseResult.success) {
            logger.api.debug({ topic }, 'Received subscription data');
            resolve(parseResult.data);
          } else {
            logger.api.error(
              { err: parseResult.error },
              `Failed to parse ${topic} response`,
            );
            reject(new TradeRepublicError(`Invalid ${topic} response format`));
          }
        }
      };

      const errorHandler = (error: Error | WebSocketMessage): void => {
        if (resolved) {
          return;
        }
        if (error instanceof Error) {
          resolved = true;
          cleanup();
          reject(error);
        } else if (error.id === subscriptionId) {
          resolved = true;
          cleanup();
          const payload = error.payload as { message?: string } | undefined;
          reject(
            new TradeRepublicError(payload?.message || String(error.payload)),
          );
        }
      };

      this.api.onMessage(messageHandler);
      this.api.onError(errorHandler);

      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          logger.api.error(
            `${topic} subscription timed out after ${this.timeoutMs}ms`,
          );
          reject(new TradeRepublicError(`${topic} request timed out`));
        }
      }, this.timeoutMs);

      try {
        subscriptionId = this.api.subscribe({ topic, payload });
        logger.api.debug(
          { topic, subscriptionId, payload },
          'Subscribed to topic',
        );
      } catch (error) {
        resolved = true;
        cleanup();
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new TradeRepublicError(String(error)));
        }
      }
    });
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
