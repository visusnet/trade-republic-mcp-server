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
  TradeRepublicError,
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
    return this.api.subscribeAndWait(
      'compactPortfolio',
      {},
      GetPortfolioResponseSchema,
      this.timeoutMs,
    );
  }

  public async getCashBalance(
    _request?: GetCashBalanceRequest,
  ): Promise<GetCashBalanceResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting cash balance data');
    return this.api.subscribeAndWait(
      'cash',
      {},
      GetCashBalanceResponseSchema,
      this.timeoutMs,
    );
  }

  private ensureAuthenticated(): void {
    if (this.api.getAuthStatus() !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }
}
