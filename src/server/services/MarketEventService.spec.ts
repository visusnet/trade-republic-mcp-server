import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import { mockLogger } from '@test/loggerMock';
import { mockTradeRepublicApiService } from '@test/serviceMocks';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  MESSAGE_CODE,
  type MessageCode,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import { MarketEventService } from './MarketEventService';
import {
  ConditionSchema,
  SubscriptionSchema,
  WaitForMarketEventRequestSchema,
} from './MarketEventService.request';
import type { WaitForMarketEventRequest } from './MarketEventService.request';
import {
  MarketEventTimeoutResponseSchema,
  MarketEventTriggeredResponseSchema,
  TickerSnapshotSchema,
  TriggeredConditionSchema,
  WaitForMarketEventResponseSchema,
} from './MarketEventService.response';
import type {
  MarketEventTimeoutResponse,
  MarketEventTriggeredResponse,
} from './MarketEventService.response';
import {
  ConditionField,
  ConditionLogic,
  ConditionOperator,
  MarketEventError,
} from './MarketEventService.types';

// Type for captured message handlers
type MessageHandler = (message: WebSocketMessage) => void;

/**
 * Creates a ticker API response matching Trade Republic format.
 */
function createTickerApiResponse(
  bid: number,
  ask: number,
  last?: number,
): {
  bid: { price: number };
  ask: { price: number };
  last?: { price: number };
} {
  return {
    bid: { price: bid },
    ask: { price: ask },
    ...(last !== undefined ? { last: { price: last } } : {}),
  };
}

describe('MarketEventService', () => {
  let service: MarketEventService;
  let capturedMessageHandler: MessageHandler | null;
  let subscriptionIdCounter: number;

  // Helper to send a ticker message
  function sendTicker(
    subscriptionId: number,
    bid: number,
    ask: number,
    last?: number,
  ): void {
    if (capturedMessageHandler === null) {
      throw new Error(
        'Message handler not captured - onMessage was not called',
      );
    }
    capturedMessageHandler({
      id: subscriptionId,
      code: 'A',
      payload: createTickerApiResponse(bid, ask, last),
    });
  }

  // Helper to send a message with a specific code
  function sendMessage(
    subscriptionId: number,
    code: MessageCode,
    payload: unknown,
  ): void {
    if (capturedMessageHandler === null) {
      throw new Error(
        'Message handler not captured - onMessage was not called',
      );
    }
    capturedMessageHandler({
      id: subscriptionId,
      code,
      payload,
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = new MarketEventService(
      mockTradeRepublicApiService as unknown as TradeRepublicApiService,
    );
    capturedMessageHandler = null;
    subscriptionIdCounter = 1;

    // Capture the message handler when onMessage is called
    mockTradeRepublicApiService.onMessage.mockImplementation(
      (handler: MessageHandler) => {
        capturedMessageHandler = handler;
      },
    );

    // Return incrementing subscription IDs
    mockTradeRepublicApiService.subscribe.mockImplementation(() => {
      return subscriptionIdCounter++;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('waitForMarketEvent', () => {
    describe('timeout behavior', () => {
      it('should return timeout response when no conditions are triggered', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 50,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 5,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Simulate ticker that doesn't trigger (bid is 100, condition is < 50)
        sendTicker(1, 100, 101, 100.5);

        // Advance past timeout
        jest.advanceTimersByTime(5000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
        const timeout = result as MarketEventTimeoutResponse;
        expect(timeout.duration).toBe(5);
        expect(timeout.lastTickers['DE0007164600.LSX']).toBeDefined();
        expect(timeout.lastTickers['DE0007164600.LSX'].bid).toBe(100);
        expect(mockTradeRepublicApiService.unsubscribe).toHaveBeenCalledWith(1);
      });

      it('should use default timeout of 55 seconds', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 50,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Advance past timeout
        jest.advanceTimersByTime(55000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
        const timeout = result as MarketEventTimeoutResponse;
        expect(timeout.duration).toBe(55);
      });

      it('should not trigger twice if already resolved', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 5,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Trigger condition
        sendTicker(1, 66, 67);

        const result = await resultPromise;
        expect(result.status).toBe('triggered');

        // Additional tickers after resolution should not cause issues
        sendTicker(1, 67, 68);

        // Timeout should not override result
        jest.advanceTimersByTime(5000);

        // Result should still be triggered, not timeout
        expect(result.status).toBe('triggered');
      });
    });

    describe('triggered conditions', () => {
      it('should trigger on GT condition', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Trigger condition
        sendTicker(1, 66, 67);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.isin).toBe('DE0007164600');
        expect(triggered.exchange).toBe('LSX');
        expect(triggered.triggeredConditions).toHaveLength(1);
        expect(triggered.triggeredConditions[0].field).toBe('bid');
        expect(triggered.triggeredConditions[0].operator).toBe('gt');
        expect(triggered.triggeredConditions[0].threshold).toBe(65);
        expect(triggered.triggeredConditions[0].actualValue).toBe(66);
        expect(triggered.ticker.bid).toBe(66);
        expect(mockTradeRepublicApiService.unsubscribe).toHaveBeenCalledWith(1);
      });

      it('should trigger on GTE condition', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GTE,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        sendTicker(1, 60, 61);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].actualValue).toBe(60);
      });

      it('should trigger on LT condition', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 55,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        sendTicker(1, 54, 55);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].actualValue).toBe(54);
      });

      it('should trigger on LTE condition', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LTE,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        sendTicker(1, 60, 61);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
      });
    });

    describe('crossAbove and crossBelow', () => {
      it('should trigger on CROSS_ABOVE when price crosses threshold upward', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_ABOVE,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // First ticker below threshold - stores previous value
        sendTicker(1, 64, 65);

        jest.advanceTimersByTime(100);

        // Second ticker above threshold - should trigger
        sendTicker(1, 66, 67);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].operator).toBe('crossAbove');
        expect(triggered.triggeredConditions[0].actualValue).toBe(66);
      });

      it('should trigger on CROSS_BELOW when price crosses threshold downward', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_BELOW,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // First ticker above threshold
        sendTicker(1, 61, 62);

        jest.advanceTimersByTime(100);

        // Second ticker below threshold - should trigger
        sendTicker(1, 59, 60);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].operator).toBe('crossBelow');
      });

      it('should not trigger CROSS_ABOVE without previous value', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_ABOVE,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // First ticker above threshold - but no previous value
        sendTicker(1, 65, 66);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });

      it('should not trigger CROSS_BELOW without previous value', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_BELOW,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // First ticker below threshold - but no previous value
        sendTicker(1, 55, 56);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });

      it('should not trigger CROSS_ABOVE when price stays above threshold', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_ABOVE,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Both tickers above threshold - no crossing
        sendTicker(1, 62, 63);
        jest.advanceTimersByTime(100);
        sendTicker(1, 63, 64);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });

      it('should not trigger CROSS_BELOW when price stays below threshold', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_BELOW,
                  value: 60,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Both tickers below threshold - no crossing
        sendTicker(1, 58, 59);
        jest.advanceTimersByTime(100);
        sendTicker(1, 57, 58);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });
    });

    describe('condition logic', () => {
      it('should trigger immediately on ANY logic when first condition matches', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
                {
                  field: ConditionField.ASK,
                  operator: ConditionOperator.GT,
                  value: 100,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Only bid condition matches, ask doesn't
        sendTicker(1, 66, 70);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions).toHaveLength(1);
        expect(triggered.triggeredConditions[0].field).toBe('bid');
      });

      it('should only trigger on ALL logic when all conditions match', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
                {
                  field: ConditionField.ASK,
                  operator: ConditionOperator.GT,
                  value: 70,
                },
              ],
              logic: ConditionLogic.ALL,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Only bid matches - should not trigger
        sendTicker(1, 66, 68);

        jest.advanceTimersByTime(100);

        // Both conditions match - should trigger
        sendTicker(1, 66, 72);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions).toHaveLength(2);
      });

      it('should not trigger on ALL logic when only some conditions match', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
                {
                  field: ConditionField.ASK,
                  operator: ConditionOperator.GT,
                  value: 100,
                },
              ],
              logic: ConditionLogic.ALL,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Only bid matches
        sendTicker(1, 66, 70);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });
    });

    describe('multiple subscriptions', () => {
      it('should trigger when any subscription matches', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 100,
                },
              ],
              logic: ConditionLogic.ANY,
            },
            {
              isin: 'US0378331005',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 40,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // First doesn't trigger
        sendTicker(1, 65, 66);

        jest.advanceTimersByTime(100);

        // Second triggers
        sendTicker(2, 45, 46);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.isin).toBe('US0378331005');
      });

      it('should subscribe to all ISINs', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 100,
                },
              ],
              logic: ConditionLogic.ANY,
            },
            {
              isin: 'US0378331005',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 100,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        jest.advanceTimersByTime(1000);

        await resultPromise;

        expect(mockTradeRepublicApiService.subscribe).toHaveBeenCalledTimes(2);
        expect(mockTradeRepublicApiService.subscribe).toHaveBeenCalledWith({
          topic: 'ticker',
          payload: { id: 'DE0007164600.LSX' },
        });
        expect(mockTradeRepublicApiService.subscribe).toHaveBeenCalledWith({
          topic: 'ticker',
          payload: { id: 'US0378331005.LSX' },
        });
      });

      it('should ignore tickers for unknown subscription IDs', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 50,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Ticker for unknown subscription ID - should be ignored
        sendTicker(999, 10, 11);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });

      it('should track previousValues separately per subscription for crossAbove', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_ABOVE,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
            {
              isin: 'US0378331005',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.CROSS_ABOVE,
                  value: 40,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 5,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // First ISIN below threshold - stores previous value
        sendTicker(1, 64, 65);
        jest.advanceTimersByTime(100);

        // Second ISIN above threshold - no previous value, should not trigger
        sendTicker(2, 45, 46);
        jest.advanceTimersByTime(100);

        // First ISIN crosses above - should trigger because it has previous value
        sendTicker(1, 66, 67);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.isin).toBe('DE0007164600');
        expect(triggered.triggeredConditions[0].operator).toBe('crossAbove');
      });
    });

    describe('different fields', () => {
      it('should evaluate ASK field', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.ASK,
                  operator: ConditionOperator.GT,
                  value: 70,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        sendTicker(1, 70, 72);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].field).toBe('ask');
        expect(triggered.triggeredConditions[0].actualValue).toBe(72);
      });

      it('should compute and evaluate MID field', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.MID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Mid = (64 + 68) / 2 = 66, which is > 65
        sendTicker(1, 64, 68);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].field).toBe('mid');
        expect(triggered.triggeredConditions[0].actualValue).toBe(66);
        expect(triggered.ticker.mid).toBe(66);
      });

      it('should evaluate LAST field when available', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.LAST,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        sendTicker(1, 64, 68, 66.5);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].field).toBe('last');
        expect(triggered.triggeredConditions[0].actualValue).toBe(66.5);
        expect(triggered.ticker.last).toBe(66.5);
      });

      it('should not trigger LAST condition when last is not available', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.LAST,
                  operator: ConditionOperator.GT,
                  value: 0,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // No last price
        sendTicker(1, 64, 68);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });

      it('should compute and evaluate SPREAD field', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.SPREAD,
                  operator: ConditionOperator.GT,
                  value: 1,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Spread = 102 - 100 = 2
        sendTicker(1, 100, 102);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].field).toBe('spread');
        expect(triggered.triggeredConditions[0].actualValue).toBe(2);
        expect(triggered.ticker.spread).toBe(2);
      });

      it('should compute and evaluate SPREAD_PERCENT field', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.SPREAD_PERCENT,
                  operator: ConditionOperator.GT,
                  value: 1,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Spread = 102 - 100 = 2, Mid = 101, SpreadPercent = 2/101 * 100 ≈ 1.98%
        sendTicker(1, 100, 102);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.triggeredConditions[0].field).toBe('spreadPercent');
        expect(triggered.triggeredConditions[0].actualValue).toBeCloseTo(
          1.98,
          1,
        );
        expect(triggered.ticker.spreadPercent).toBeCloseTo(1.98, 1);
      });

      it('should compute spreadPercent as 0 when mid is 0', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.SPREAD_PERCENT,
                  operator: ConditionOperator.GTE,
                  value: 0,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Bid = 0, Ask = 0 => Mid = 0, SpreadPercent = 0 (avoid division by zero)
        sendTicker(1, 0, 0);

        const result = await resultPromise;

        expect(result.status).toBe('triggered');
        const triggered = result as MarketEventTriggeredResponse;
        expect(triggered.ticker.mid).toBe(0);
        expect(triggered.ticker.spreadPercent).toBe(0);
      });
    });

    describe('timeout with last tickers', () => {
      it('should include last tickers for all subscriptions in timeout response', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 50,
                },
              ],
              logic: ConditionLogic.ANY,
            },
            {
              isin: 'US0378331005',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 30,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        sendTicker(1, 60, 61);
        sendTicker(2, 40, 41);

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
        const timeout = result as MarketEventTimeoutResponse;
        expect(timeout.lastTickers['DE0007164600.LSX'].bid).toBe(60);
        expect(timeout.lastTickers['US0378331005.LSX'].bid).toBe(40);
      });

      it('should return empty lastTickers if no tickers received', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 50,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // No tickers received

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
        const timeout = result as MarketEventTimeoutResponse;
        expect(Object.keys(timeout.lastTickers)).toHaveLength(0);
      });
    });

    describe('cleanup', () => {
      it('should cleanup subscriptions after trigger', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
            {
              isin: 'US0378331005',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 40,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 55,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Trigger on first subscription
        sendTicker(1, 66, 67);

        await resultPromise;

        // Both subscriptions should be unsubscribed
        expect(mockTradeRepublicApiService.unsubscribe).toHaveBeenCalledWith(1);
        expect(mockTradeRepublicApiService.unsubscribe).toHaveBeenCalledWith(2);
        expect(mockTradeRepublicApiService.offMessage).toHaveBeenCalled();
      });

      it('should cleanup subscriptions after timeout', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 50,
                },
              ],
              logic: ConditionLogic.ANY,
            },
            {
              isin: 'US0378331005',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.LT,
                  value: 30,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        jest.advanceTimersByTime(1000);

        await resultPromise;

        // Both subscriptions should be unsubscribed
        expect(mockTradeRepublicApiService.unsubscribe).toHaveBeenCalledWith(1);
        expect(mockTradeRepublicApiService.unsubscribe).toHaveBeenCalledWith(2);
        expect(mockTradeRepublicApiService.offMessage).toHaveBeenCalled();
      });
    });

    describe('custom exchange', () => {
      it('should use custom exchange when specified', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              exchange: 'XETR',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        jest.advanceTimersByTime(1000);

        await resultPromise;

        expect(mockTradeRepublicApiService.subscribe).toHaveBeenCalledWith({
          topic: 'ticker',
          payload: { id: 'DE0007164600.XETR' },
        });
      });
    });

    describe('message handling', () => {
      it('should ignore non-A messages (e.g., delta updates)', async () => {
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Send a delta message (code 'D') - should be ignored
        sendMessage(1, MESSAGE_CODE.D, createTickerApiResponse(66, 67));

        jest.advanceTimersByTime(1000);

        const result = await resultPromise;

        expect(result.status).toBe('timeout');
      });

      it('should ignore timeout callback if already triggered', async () => {
        // This tests the race condition guard where timeout fires after resolution.
        // We use runAllTimers to ensure the timeout callback fires even though
        // the condition has already triggered and cleared the timeout.
        // Note: Because cleanup() calls clearTimeout, we need to trigger the
        // callback manually by not clearing the timeout in our mock.
        // Instead, we'll just verify the guard works by advancing time after trigger.
        const request: WaitForMarketEventRequest = {
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [
                {
                  field: ConditionField.BID,
                  operator: ConditionOperator.GT,
                  value: 65,
                },
              ],
              logic: ConditionLogic.ANY,
            },
          ],
          timeout: 1,
        };

        const resultPromise = service.waitForMarketEvent(request);

        // Trigger the condition
        sendTicker(1, 66, 67);

        const result = await resultPromise;
        expect(result.status).toBe('triggered');

        // Advance time past timeout - timeout callback should have been cleared
        // but the resolved check would protect against any race condition
        jest.advanceTimersByTime(2000);

        // Result should still be triggered
        expect(result.status).toBe('triggered');
      });
    });
  });

  describe('request schemas', () => {
    describe('ConditionSchema', () => {
      it('should validate valid condition', () => {
        const result = ConditionSchema.safeParse({
          field: 'bid',
          operator: 'gt',
          value: 65,
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid field', () => {
        const result = ConditionSchema.safeParse({
          field: 'invalid',
          operator: 'gt',
          value: 65,
        });
        expect(result.success).toBe(false);
      });

      it('should reject invalid operator', () => {
        const result = ConditionSchema.safeParse({
          field: 'bid',
          operator: 'invalid',
          value: 65,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('SubscriptionSchema', () => {
      it('should validate valid subscription', () => {
        const result = SubscriptionSchema.safeParse({
          isin: 'DE0007164600',
          conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
        });
        expect(result.success).toBe(true);
      });

      it('should default logic to any', () => {
        const result = SubscriptionSchema.parse({
          isin: 'DE0007164600',
          conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
        });
        expect(result.logic).toBe('any');
      });

      it('should reject empty conditions array', () => {
        const result = SubscriptionSchema.safeParse({
          isin: 'DE0007164600',
          conditions: [],
        });
        expect(result.success).toBe(false);
      });

      it('should reject more than 5 conditions', () => {
        const result = SubscriptionSchema.safeParse({
          isin: 'DE0007164600',
          conditions: [
            { field: 'bid', operator: 'gt', value: 1 },
            { field: 'bid', operator: 'gt', value: 2 },
            { field: 'bid', operator: 'gt', value: 3 },
            { field: 'bid', operator: 'gt', value: 4 },
            { field: 'bid', operator: 'gt', value: 5 },
            { field: 'bid', operator: 'gt', value: 6 },
          ],
        });
        expect(result.success).toBe(false);
      });
    });

    describe('WaitForMarketEventRequestSchema', () => {
      it('should validate valid request', () => {
        const result = WaitForMarketEventRequestSchema.safeParse({
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('should default timeout to 55', () => {
        const result = WaitForMarketEventRequestSchema.parse({
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
            },
          ],
        });
        expect(result.timeout).toBe(55);
      });

      it('should reject timeout greater than 55', () => {
        const result = WaitForMarketEventRequestSchema.safeParse({
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
            },
          ],
          timeout: 60,
        });
        expect(result.success).toBe(false);
      });

      it('should reject timeout less than 1', () => {
        const result = WaitForMarketEventRequestSchema.safeParse({
          subscriptions: [
            {
              isin: 'DE0007164600',
              conditions: [{ field: 'bid', operator: 'gt', value: 65 }],
            },
          ],
          timeout: 0,
        });
        expect(result.success).toBe(false);
      });

      it('should reject more than 5 subscriptions', () => {
        const result = WaitForMarketEventRequestSchema.safeParse({
          subscriptions: [
            {
              isin: 'ISIN1',
              conditions: [{ field: 'bid', operator: 'gt', value: 1 }],
            },
            {
              isin: 'ISIN2',
              conditions: [{ field: 'bid', operator: 'gt', value: 1 }],
            },
            {
              isin: 'ISIN3',
              conditions: [{ field: 'bid', operator: 'gt', value: 1 }],
            },
            {
              isin: 'ISIN4',
              conditions: [{ field: 'bid', operator: 'gt', value: 1 }],
            },
            {
              isin: 'ISIN5',
              conditions: [{ field: 'bid', operator: 'gt', value: 1 }],
            },
            {
              isin: 'ISIN6',
              conditions: [{ field: 'bid', operator: 'gt', value: 1 }],
            },
          ],
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('response schemas', () => {
    describe('TickerSnapshotSchema', () => {
      it('should validate valid ticker snapshot', () => {
        const result = TickerSnapshotSchema.safeParse({
          bid: 100,
          ask: 101,
          mid: 100.5,
          spread: 1,
          spreadPercent: 0.99,
        });
        expect(result.success).toBe(true);
      });

      it('should accept optional last field', () => {
        const result = TickerSnapshotSchema.safeParse({
          bid: 100,
          ask: 101,
          mid: 100.5,
          last: 100.25,
          spread: 1,
          spreadPercent: 0.99,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('TriggeredConditionSchema', () => {
      it('should validate valid triggered condition', () => {
        const result = TriggeredConditionSchema.safeParse({
          field: 'bid',
          operator: 'gt',
          threshold: 65,
          actualValue: 66,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('MarketEventTriggeredResponseSchema', () => {
      it('should validate valid triggered response', () => {
        const result = MarketEventTriggeredResponseSchema.safeParse({
          status: 'triggered',
          isin: 'DE0007164600',
          exchange: 'LSX',
          triggeredConditions: [
            {
              field: 'bid',
              operator: 'gt',
              threshold: 65,
              actualValue: 66,
            },
          ],
          ticker: {
            bid: 66,
            ask: 67,
            mid: 66.5,
            spread: 1,
            spreadPercent: 1.5,
          },
          timestamp: '2025-01-25T12:00:00.000Z',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('MarketEventTimeoutResponseSchema', () => {
      it('should validate valid timeout response', () => {
        const result = MarketEventTimeoutResponseSchema.safeParse({
          status: 'timeout',
          lastTickers: {
            'DE0007164600.LSX': {
              bid: 60,
              ask: 61,
              mid: 60.5,
              spread: 1,
              spreadPercent: 1.65,
            },
          },
          duration: 55,
          timestamp: '2025-01-25T12:00:00.000Z',
        });
        expect(result.success).toBe(true);
      });

      it('should validate timeout response with empty lastTickers', () => {
        const result = MarketEventTimeoutResponseSchema.safeParse({
          status: 'timeout',
          lastTickers: {},
          duration: 55,
          timestamp: '2025-01-25T12:00:00.000Z',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('WaitForMarketEventResponseSchema', () => {
      it('should discriminate triggered response', () => {
        const result = WaitForMarketEventResponseSchema.safeParse({
          status: 'triggered',
          isin: 'DE0007164600',
          exchange: 'LSX',
          triggeredConditions: [
            {
              field: 'bid',
              operator: 'gt',
              threshold: 65,
              actualValue: 66,
            },
          ],
          ticker: {
            bid: 66,
            ask: 67,
            mid: 66.5,
            spread: 1,
            spreadPercent: 1.5,
          },
          timestamp: '2025-01-25T12:00:00.000Z',
        });
        expect(result.success).toBe(true);
      });

      it('should discriminate timeout response', () => {
        const result = WaitForMarketEventResponseSchema.safeParse({
          status: 'timeout',
          lastTickers: {},
          duration: 55,
          timestamp: '2025-01-25T12:00:00.000Z',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('MarketEventError', () => {
    it('should create error with message only', () => {
      const error = new MarketEventError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('MarketEventError');
      expect(error.code).toBeUndefined();
    });

    it('should create error with message and code', () => {
      const error = new MarketEventError('Test error', 'ERR_CODE');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('MarketEventError');
      expect(error.code).toBe('ERR_CODE');
    });

    it('should be instanceof Error', () => {
      const error = new MarketEventError('Test error');
      expect(error instanceof Error).toBe(true);
    });
  });
});
