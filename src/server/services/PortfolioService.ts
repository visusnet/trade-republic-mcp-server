/**
 * Portfolio Service
 *
 * Provides methods for retrieving portfolio and cash balance data
 * from the Trade Republic API via WebSocket subscriptions.
 */

import { logger } from '../../logger';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';
import type {
  GetPortfolioRequest,
  GetCashBalanceRequest,
} from './PortfolioService.request';
import {
  GetPortfolioResponseSchema,
  GetCashBalanceResponseSchema,
  type GetPortfolioResponse,
  type GetCashBalanceResponse,
} from './PortfolioService.response';

const DEFAULT_SUBSCRIPTION_TIMEOUT_MS = 30_000;

export class PortfolioService {
  constructor(
    private readonly api: TradeRepublicApiService,
    private readonly timeoutMs: number = DEFAULT_SUBSCRIPTION_TIMEOUT_MS,
  ) {}

  public async getPortfolio(
    _request?: GetPortfolioRequest,
  ): Promise<GetPortfolioResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting portfolio data');
    return this.subscribeAndWait<GetPortfolioResponse>(
      'compactPortfolio',
      GetPortfolioResponseSchema,
    );
  }

  public async getCashBalance(
    _request?: GetCashBalanceRequest,
  ): Promise<GetCashBalanceResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting cash balance data');
    return this.subscribeAndWait<GetCashBalanceResponse>(
      'cash',
      GetCashBalanceResponseSchema,
    );
  }

  private subscribeAndWait<T>(
    topic: string,
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
        subscriptionId = this.api.subscribe({ topic });
        logger.api.debug({ topic, subscriptionId }, 'Subscribed to topic');
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

  private ensureAuthenticated(): void {
    if (this.api.getAuthStatus() !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }
}
