/**
 * Risk Service
 *
 * Pure calculation service for risk management tools:
 * - Kelly Criterion position sizing
 * - Risk metrics (volatility, VaR, max drawdown, Sharpe ratio)
 *
 * NO external API calls - caller provides data.
 */

import {
  type CalculatePositionSizeRequest,
  type CalculatePositionSizeResponse,
  CalculatePositionSizeResponseSchema,
  type GetRiskMetricsRequest,
  type GetRiskMetricsResponse,
  GetRiskMetricsResponseSchema,
  type VolatilityResult,
  type VaRResult,
  type MaxDrawdownResult,
  PERIODS_PER_YEAR,
  VAR_Z_SCORES,
} from './RiskService.types';

export class RiskService {
  /**
   * Calculate optimal position size using Kelly Criterion.
   */
  public calculatePositionSize(
    request: CalculatePositionSizeRequest,
  ): CalculatePositionSizeResponse {
    // 1. Calculate win/loss ratio
    const winLossRatio = request.avgWin / request.avgLoss;

    // 2. Calculate raw Kelly percentage
    const kellyPercentage = this.calculateKellyPercentage(
      request.winRate,
      winLossRatio,
    );

    // 3. Apply fractional Kelly
    const kellyFraction = request.kellyFraction ?? 0.25;
    let adjustedPercentage = kellyPercentage * kellyFraction;

    // 4. Calculate available capital (after reserve)
    const minCashReservePct = request.minCashReservePct ?? 0.1;
    const availableCapital = request.accountBalance * (1 - minCashReservePct);

    // 5. Apply max position cap
    const maxPositionPct = request.maxPositionPct ?? 0.1;
    const maxPositionSize = request.accountBalance * maxPositionPct;

    // Cap adjusted percentage to not exceed max position percentage
    const cappedPercentage = Math.max(
      0,
      Math.min(adjustedPercentage, maxPositionPct),
    );

    // 6. Calculate final position size
    // Use the smaller of: available capital * adjusted% OR max position size
    const positionSizeAmount = Math.min(
      availableCapital * cappedPercentage,
      maxPositionSize,
    );

    // Update adjusted percentage to reflect actual cap applied
    adjustedPercentage = cappedPercentage;

    // 7. Generate warnings
    const warnings = this.generateWarnings(
      kellyPercentage,
      request.winRate,
      winLossRatio,
    );

    return CalculatePositionSizeResponseSchema.parse({
      kellyPercentage,
      adjustedPercentage,
      positionSizeAmount,
      maxPositionSize,
      availableCapital,
      winLossRatio,
      warnings,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate comprehensive risk metrics from price history.
   */
  public getRiskMetrics(
    request: GetRiskMetricsRequest,
  ): GetRiskMetricsResponse {
    // 1. Calculate log returns from prices
    const logReturns = this.calculateLogReturns(request.prices);

    // 2. Calculate volatility
    const timeframe = request.timeframe ?? 'daily';
    const volatility = this.calculateVolatility(logReturns, timeframe);

    // 3. Calculate VaR (parametric and historical)
    const confidenceLevel = request.confidenceLevel ?? '0.95';
    const var_ = this.calculateVaR(logReturns, confidenceLevel);

    // 4. Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(request.prices);

    // 5. Calculate Sharpe ratio
    const riskFreeRate = request.riskFreeRate ?? 0.02;
    const sharpeRatio = this.calculateSharpeRatio(
      logReturns,
      volatility.annualized,
      riskFreeRate,
      timeframe,
    );

    // 6. Calculate return statistics
    const totalReturn =
      (request.prices[request.prices.length - 1] - request.prices[0]) /
      request.prices[0];
    const meanLogReturn =
      logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const periodsPerYear = PERIODS_PER_YEAR[timeframe];
    const annualizedReturn = Math.exp(meanLogReturn * periodsPerYear) - 1;

    return GetRiskMetricsResponseSchema.parse({
      volatility,
      valueAtRisk: var_,
      maxDrawdown,
      sharpeRatio,
      returns: {
        total: totalReturn,
        mean: meanLogReturn,
        annualized: annualizedReturn,
      },
      dataPoints: request.prices.length,
      timeframe,
      timestamp: new Date().toISOString(),
    });
  }

  // Private calculation methods

  /**
   * Calculate Kelly percentage: W - (1-W)/R
   */
  private calculateKellyPercentage(
    winRate: number,
    winLossRatio: number,
  ): number {
    return winRate - (1 - winRate) / winLossRatio;
  }

  /**
   * Calculate log returns: ln(P_t / P_{t-1})
   */
  private calculateLogReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    return returns;
  }

  /**
   * Calculate volatility (standard deviation) and annualize.
   */
  private calculateVolatility(
    returns: number[],
    timeframe: string,
  ): VolatilityResult {
    // Calculate mean
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Calculate variance
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;

    // Daily volatility is standard deviation
    const daily = Math.sqrt(variance);

    // Annualize based on timeframe
    const periodsPerYear = PERIODS_PER_YEAR[timeframe];
    const annualized = daily * Math.sqrt(periodsPerYear);

    return { daily, annualized };
  }

  /**
   * Calculate Value at Risk using both parametric and historical methods.
   */
  private calculateVaR(returns: number[], confidenceLevel: string): VaRResult {
    // Calculate mean and std dev
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    // Parametric VaR: -(μ + z × σ)
    const zScore = VAR_Z_SCORES[confidenceLevel];
    const parametric = -(mean + zScore * stdDev);

    // Historical VaR: percentile of returns
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const percentile = confidenceLevel === '0.95' ? 0.05 : 0.01;
    const index = Math.floor(sortedReturns.length * percentile);
    const historical = -sortedReturns[index];

    return {
      parametric,
      historical,
      confidenceLevel,
    };
  }

  /**
   * Calculate maximum drawdown from peak to trough.
   */
  private calculateMaxDrawdown(prices: number[]): MaxDrawdownResult {
    let maxDrawdown = 0;
    let maxDrawdownValue = 0;
    let peakIndex = 0;
    let troughIndex = 0;
    let peak = prices[0];
    let currentPeakIndex = 0;

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i];
        currentPeakIndex = i;
      }

      const drawdown = (peak - prices[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownValue = peak - prices[i];
        peakIndex = currentPeakIndex;
        troughIndex = i;
      }
    }

    return {
      value: maxDrawdownValue,
      percent: maxDrawdown,
      peakIndex,
      troughIndex,
    };
  }

  /**
   * Calculate annualized Sharpe ratio.
   */
  private calculateSharpeRatio(
    returns: number[],
    annualizedVolatility: number,
    riskFreeRate: number,
    timeframe: string,
  ): number | null {
    // Return null if zero volatility
    if (annualizedVolatility === 0) {
      return null;
    }

    // Calculate annualized return
    const meanLogReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const periodsPerYear = PERIODS_PER_YEAR[timeframe];
    const annualizedReturn = Math.exp(meanLogReturn * periodsPerYear) - 1;

    // Sharpe = (R_annual - R_f) / σ_annual
    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
  }

  /**
   * Generate warnings for position sizing.
   */
  private generateWarnings(
    kellyPercentage: number,
    winRate: number,
    winLossRatio: number,
  ): string[] {
    const warnings: string[] = [];

    // Negative Kelly - system has negative edge
    if (kellyPercentage < 0) {
      warnings.push(
        'WARNING: Negative Kelly percentage indicates a losing strategy. DO NOT TRADE.',
      );
    }

    // Zero or near-zero win rate
    if (winRate < 0.01) {
      warnings.push(
        'WARNING: Win rate is near zero. Insufficient data or highly unreliable strategy.',
      );
    }

    // 100% or near-100% win rate
    if (winRate > 0.99) {
      warnings.push(
        'WARNING: Win rate is near 100%. This is unrealistic for most trading strategies.',
      );
    }

    // Very high win/loss ratio
    if (winLossRatio > 10) {
      warnings.push(
        'WARNING: Win/Loss ratio is very high. Verify average win/loss calculations.',
      );
    }

    // Very low win/loss ratio
    if (winLossRatio < 0.1) {
      warnings.push(
        'WARNING: Win/Loss ratio is very low. Average losses significantly exceed average wins.',
      );
    }

    return warnings;
  }
}
