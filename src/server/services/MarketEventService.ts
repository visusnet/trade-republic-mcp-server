/**
 * Market Event Service
 *
 * Monitors market data via WebSocket subscriptions and triggers when
 * specified conditions are met. Supports multiple ISINs with multiple
 * conditions using AND/OR logic.
 */

import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  MESSAGE_CODE,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import type {
  Condition,
  Subscription,
  WaitForMarketEventRequest,
} from './MarketEventService.request';
import type {
  TickerSnapshot,
  TriggeredCondition,
  WaitForMarketEventResponse,
} from './MarketEventService.response';
import {
  ConditionField,
  ConditionLogic,
  ConditionOperator,
} from './MarketEventService.types';

/** Default exchange if not specified */
const DEFAULT_EXCHANGE = 'LSX';

/** Ticker API response from Trade Republic */
interface TickerApiResponse {
  bid: { price: number };
  ask: { price: number };
  last?: { price: number };
}

/**
 * Gets the value of a specific field from a ticker snapshot.
 * Returns undefined if the field is not available (e.g., last price when there is no last trade).
 */
function getFieldValue(
  ticker: TickerSnapshot,
  field: ConditionField,
): number | undefined {
  switch (field) {
    case ConditionField.BID:
      return ticker.bid;
    case ConditionField.ASK:
      return ticker.ask;
    case ConditionField.MID:
      return ticker.mid;
    case ConditionField.LAST:
      return ticker.last;
    case ConditionField.SPREAD:
      return ticker.spread;
    case ConditionField.SPREAD_PERCENT:
      return ticker.spreadPercent;
  }
}

/**
 * Evaluates a single operator against actual and threshold values.
 */
function evaluateOperator(
  actual: number,
  operator: ConditionOperator,
  threshold: number,
  previous?: number,
): boolean {
  switch (operator) {
    case ConditionOperator.GT:
      return actual > threshold;
    case ConditionOperator.GTE:
      return actual >= threshold;
    case ConditionOperator.LT:
      return actual < threshold;
    case ConditionOperator.LTE:
      return actual <= threshold;
    case ConditionOperator.CROSS_ABOVE:
      return (
        previous !== undefined && previous <= threshold && actual > threshold
      );
    case ConditionOperator.CROSS_BELOW:
      return (
        previous !== undefined && previous >= threshold && actual < threshold
      );
  }
}

/**
 * Computes a ticker snapshot from the API response.
 */
function computeTicker(apiResponse: TickerApiResponse): TickerSnapshot {
  const bid = apiResponse.bid.price;
  const ask = apiResponse.ask.price;
  const mid = (bid + ask) / 2;
  const spread = ask - bid;
  const spreadPercent = mid > 0 ? (spread / mid) * 100 : 0;
  const last = apiResponse.last?.price;

  return {
    bid,
    ask,
    mid,
    spread,
    spreadPercent,
    ...(last !== undefined ? { last } : {}),
  };
}

/**
 * Service for monitoring market events via WebSocket.
 */
export class MarketEventService {
  constructor(private readonly api: TradeRepublicApiService) {}

  /**
   * Waits for market conditions to be met or timeout.
   */
  public waitForMarketEvent(
    request: WaitForMarketEventRequest,
  ): Promise<WaitForMarketEventResponse> {
    return new Promise((resolve) => {
      const lastTickers = new Map<string, TickerSnapshot>();
      const previousValues = new Map<string, Map<ConditionField, number>>();
      const subscriptionIds: number[] = [];
      const subscriptionMap = new Map<
        number,
        { subscription: Subscription; tickerId: string }
      >();

      let resolved = false;
      // Use object wrapper to allow const declaration while supporting deferred assignment
      const ctx = {
        timeoutId: undefined as ReturnType<typeof setTimeout> | undefined,
      };

      const cleanup = (): void => {
        if (ctx.timeoutId !== undefined) {
          clearTimeout(ctx.timeoutId);
        }
        this.api.offMessage(messageHandler);
        for (const subId of subscriptionIds) {
          this.api.unsubscribe(subId);
        }
      };

      const messageHandler = (message: WebSocketMessage): void => {
        if (resolved) {
          return;
        }

        // Find the subscription for this message
        const entry = subscriptionMap.get(message.id);
        if (!entry) {
          return;
        }

        // Only process answer messages
        if (message.code !== MESSAGE_CODE.A) {
          return;
        }

        const { subscription, tickerId } = entry;
        const apiResponse = message.payload as TickerApiResponse;
        const ticker = computeTicker(apiResponse);

        // Store last ticker
        lastTickers.set(tickerId, ticker);

        // Evaluate conditions
        const triggered = this.evaluateConditions(
          ticker,
          subscription.conditions,
          subscription.logic,
          previousValues.get(tickerId),
        );

        if (triggered.length > 0) {
          resolved = true;
          cleanup();
          const exchange = subscription.exchange ?? DEFAULT_EXCHANGE;
          resolve({
            status: 'triggered',
            isin: subscription.isin,
            exchange,
            triggeredConditions: triggered,
            ticker,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Store current values as previous for next evaluation
        this.storePreviousValues(previousValues, tickerId, ticker);
      };

      // Register message handler
      this.api.onMessage(messageHandler);

      // Subscribe to all ISINs
      for (const subscription of request.subscriptions) {
        const exchange = subscription.exchange ?? DEFAULT_EXCHANGE;
        const tickerId = `${subscription.isin}.${exchange}`;

        logger.api.debug(
          { isin: subscription.isin, exchange, tickerId },
          'Subscribing to ticker for market event',
        );

        const subId = this.api.subscribe({
          topic: 'ticker',
          payload: { id: tickerId },
        });

        subscriptionIds.push(subId);
        subscriptionMap.set(subId, { subscription, tickerId });
      }

      // Set timeout
      ctx.timeoutId = setTimeout(() => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        resolve({
          status: 'timeout',
          lastTickers: Object.fromEntries(lastTickers),
          duration: request.timeout,
          timestamp: new Date().toISOString(),
        });
      }, request.timeout * 1000);
    });
  }

  /**
   * Evaluates conditions against a ticker.
   */
  private evaluateConditions(
    ticker: TickerSnapshot,
    conditions: readonly Condition[],
    logic: ConditionLogic,
    previousValues?: Map<ConditionField, number>,
  ): TriggeredCondition[] {
    const triggered: TriggeredCondition[] = [];

    for (const condition of conditions) {
      const actual = getFieldValue(ticker, condition.field);

      // Skip if field value is not available (e.g., no last trade)
      if (actual === undefined) {
        continue;
      }

      const previous = previousValues?.get(condition.field);

      if (
        evaluateOperator(actual, condition.operator, condition.value, previous)
      ) {
        triggered.push({
          field: condition.field,
          operator: condition.operator,
          threshold: condition.value,
          actualValue: actual,
        });

        if (logic === ConditionLogic.ANY) {
          return triggered; // Early return for OR
        }
      }
    }

    // For ALL logic, only return if all conditions matched
    if (
      logic === ConditionLogic.ALL &&
      triggered.length === conditions.length
    ) {
      return triggered;
    }

    return logic === ConditionLogic.ANY ? triggered : [];
  }

  /**
   * Stores current ticker values as previous values for next evaluation.
   */
  private storePreviousValues(
    previousValues: Map<string, Map<ConditionField, number>>,
    tickerId: string,
    ticker: TickerSnapshot,
  ): void {
    const values = new Map<ConditionField, number>();
    values.set(ConditionField.BID, ticker.bid);
    values.set(ConditionField.ASK, ticker.ask);
    values.set(ConditionField.MID, ticker.mid);
    values.set(ConditionField.SPREAD, ticker.spread);
    values.set(ConditionField.SPREAD_PERCENT, ticker.spreadPercent);
    if (ticker.last !== undefined) {
      values.set(ConditionField.LAST, ticker.last);
    }
    previousValues.set(tickerId, values);
  }
}
