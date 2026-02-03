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

export class PortfolioService {
  constructor(private readonly api: TradeRepublicApiService) {}

  public async getPortfolio(
    _request?: GetPortfolioRequest,
  ): Promise<GetPortfolioResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting portfolio data');
    return this.api.subscribeAndWait(
      'compactPortfolio',
      {},
      GetPortfolioResponseSchema,
    );
  }

  public async getCashBalance(
    _request?: GetCashBalanceRequest,
  ): Promise<GetCashBalanceResponse> {
    this.ensureAuthenticated();
    logger.api.info('Requesting cash balance data');
    return this.api.subscribeAndWait('cash', {}, GetCashBalanceResponseSchema);
  }

  private ensureAuthenticated(): void {
    if (this.api.getAuthStatus() !== AuthStatus.AUTHENTICATED) {
      throw new TradeRepublicError('Not authenticated');
    }
  }
}
