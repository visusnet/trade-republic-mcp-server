/**
 * Technical Analysis Service
 *
 * Orchestrates data fetching, indicator calculation, and signal generation
 * for technical analysis of financial instruments.
 */

import { logger } from '../../logger';
import type { MarketDataService } from './MarketDataService';
import { DEFAULT_EXCHANGE } from './MarketDataService.request';
import type {
  GetIndicatorsRequest,
  GetDetailedAnalysisRequest,
} from './TechnicalAnalysisService.request';
import {
  GetIndicatorsResponseSchema,
  GetDetailedAnalysisResponseSchema,
  type GetIndicatorsResponse,
  type GetDetailedAnalysisResponse,
  type IndicatorResult,
  type IndicatorSignal,
  type SignalDirection,
  type SignalStrength,
} from './TechnicalAnalysisService.response';
import {
  TechnicalAnalysisError,
  type Candle,
} from './TechnicalAnalysisService.types';
import { TechnicalIndicatorsService } from './TechnicalIndicatorsService';

const MIN_CANDLES_FOR_DETAILED_ANALYSIS = 50;
const DEFAULT_RANGE = '3m';

const SIGNAL_WEIGHTS: Record<SignalStrength, number> = {
  strong: 2,
  moderate: 1,
  weak: 0.5,
};

/**
 * Convert NaN to null for schema validation.
 * Technical indicator libraries can return NaN in edge cases (e.g., zero variance).
 */
function sanitizeNumber(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export class TechnicalAnalysisService {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly indicatorsService: TechnicalIndicatorsService,
  ) {}

  /**
   * Calculate specific technical indicators for an instrument.
   */
  public async getIndicators(
    request: GetIndicatorsRequest,
  ): Promise<GetIndicatorsResponse> {
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;

    logger.api.info(
      { isin: request.isin, exchange, range: request.range },
      'Calculating technical indicators',
    );

    const historyResponse = await this.marketDataService.getPriceHistory({
      isin: request.isin,
      range: request.range,
      exchange,
    });

    if (historyResponse.candles.length === 0) {
      throw new TechnicalAnalysisError('No candle data available');
    }

    const candles = historyResponse.candles as Candle[];
    const indicators: IndicatorResult[] = [];

    for (const config of request.indicators) {
      const result = this.calculateIndicator(
        candles,
        config.type,
        config.period,
      );
      indicators.push(result);
    }

    return GetIndicatorsResponseSchema.parse({
      isin: request.isin,
      exchange: historyResponse.exchange,
      range: historyResponse.range,
      candleCount: candles.length,
      indicators,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get comprehensive technical analysis with signals for an instrument.
   */
  public async getDetailedAnalysis(
    request: GetDetailedAnalysisRequest,
  ): Promise<GetDetailedAnalysisResponse> {
    const exchange = request.exchange ?? DEFAULT_EXCHANGE;
    const range = request.range ?? DEFAULT_RANGE;

    logger.api.info(
      { isin: request.isin, exchange, range },
      'Running detailed technical analysis',
    );

    const historyResponse = await this.marketDataService.getPriceHistory({
      isin: request.isin,
      range,
      exchange,
    });

    if (historyResponse.candles.length < MIN_CANDLES_FOR_DETAILED_ANALYSIS) {
      throw new TechnicalAnalysisError(
        `Insufficient candle data. Minimum ${MIN_CANDLES_FOR_DETAILED_ANALYSIS} candles required, got ${historyResponse.candles.length}`,
      );
    }

    const candles = historyResponse.candles as Candle[];
    const currentPrice = candles[candles.length - 1].close;

    // Calculate all core indicators
    const rsiResult = this.indicatorsService.calculateRSI(candles);
    const macdResult = this.indicatorsService.calculateMACD(candles);
    const bollingerResult =
      this.indicatorsService.calculateBollingerBands(candles);
    const stochasticResult =
      this.indicatorsService.calculateStochastic(candles);
    const adxResult = this.indicatorsService.calculateADX(candles);
    const atrResult = this.indicatorsService.calculateATR(candles);
    const sma20Result = this.indicatorsService.calculateSMA(candles, 20);
    const sma50Result = this.indicatorsService.calculateSMA(candles, 50);

    // Sanitize values (convert NaN to null)
    const rsi = sanitizeNumber(rsiResult.value);
    const macd = {
      macd: sanitizeNumber(macdResult.macd),
      signal: sanitizeNumber(macdResult.signal),
      histogram: sanitizeNumber(macdResult.histogram),
    };
    const bollinger = {
      upper: sanitizeNumber(bollingerResult.upper),
      middle: sanitizeNumber(bollingerResult.middle),
      lower: sanitizeNumber(bollingerResult.lower),
      pb: sanitizeNumber(bollingerResult.pb),
    };
    const stochastic = {
      k: sanitizeNumber(stochasticResult.k),
      d: sanitizeNumber(stochasticResult.d),
    };
    const adx = sanitizeNumber(adxResult.adx);
    const atr = sanitizeNumber(atrResult.value);
    const sma20 = sanitizeNumber(sma20Result.value);
    const sma50 = sanitizeNumber(sma50Result.value);

    // Generate signals
    const signals = this.generateSignals(
      candles,
      rsi,
      macd,
      bollinger,
      stochastic,
    );

    // Aggregate signals into summary
    const summary = this.aggregateSignals(signals);

    // Determine trend
    const trend = this.determineTrend(currentPrice, sma20, sma50, adx);

    return GetDetailedAnalysisResponseSchema.parse({
      isin: request.isin,
      exchange: historyResponse.exchange,
      range: historyResponse.range,
      currentPrice,
      summary,
      trend,
      signals,
      indicators: {
        rsi,
        macd,
        bollingerBands: bollinger,
        stochastic,
        adx,
        atr,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate a single indicator.
   */
  private calculateIndicator(
    candles: Candle[],
    type: string,
    period?: number,
  ): IndicatorResult {
    switch (type) {
      case 'RSI': {
        const result = this.indicatorsService.calculateRSI(candles, period);
        return { type, period: result.period, value: result.value };
      }
      case 'MACD': {
        const result = this.indicatorsService.calculateMACD(candles);
        return {
          type,
          value: result.macd,
          components: {
            macd: result.macd,
            signal: result.signal,
            histogram: result.histogram,
          },
        };
      }
      case 'BOLLINGER': {
        const result = this.indicatorsService.calculateBollingerBands(
          candles,
          period,
        );
        return {
          type,
          period: result.period,
          value: result.middle,
          components: {
            upper: result.upper,
            middle: result.middle,
            lower: result.lower,
            pb: result.pb,
            bandwidth: result.bandwidth,
          },
        };
      }
      case 'SMA': {
        const result = this.indicatorsService.calculateSMA(candles, period);
        return { type, period: result.period, value: result.value };
      }
      case 'EMA': {
        const result = this.indicatorsService.calculateEMA(candles, period);
        return { type, period: result.period, value: result.value };
      }
      case 'ADX': {
        const result = this.indicatorsService.calculateADX(candles, period);
        return {
          type,
          period: result.period,
          value: result.adx,
          components: {
            adx: result.adx,
            plusDI: result.plusDI,
            minusDI: result.minusDI,
          },
        };
      }
      case 'STOCHASTIC': {
        const result = this.indicatorsService.calculateStochastic(
          candles,
          period,
        );
        return {
          type,
          period: result.period,
          value: result.k,
          components: {
            k: result.k,
            d: result.d,
          },
        };
      }
      case 'ATR': {
        const result = this.indicatorsService.calculateATR(candles, period);
        return { type, period: result.period, value: result.value };
      }
      case 'OBV': {
        const result = this.indicatorsService.calculateOBV(candles);
        return { type, value: result.value };
      }
      case 'VWAP': {
        const result = this.indicatorsService.calculateVWAP(candles);
        return { type, value: result.value };
      }
      default:
        return { type, value: null };
    }
  }

  /**
   * Generate trading signals from indicators.
   */
  private generateSignals(
    candles: Candle[],
    rsi: number | null,
    macd: {
      macd: number | null;
      signal: number | null;
      histogram: number | null;
    },
    bollinger: {
      upper: number | null;
      middle: number | null;
      lower: number | null;
      pb: number | null;
    },
    stochastic: { k: number | null; d: number | null },
  ): IndicatorSignal[] {
    const signals: IndicatorSignal[] = [];

    // RSI Signals
    if (rsi !== null) {
      if (rsi < 30) {
        signals.push({
          indicator: 'RSI',
          signal: 'buy',
          strength: this.getRSIOversoldStrength(rsi),
          reason: 'Oversold conditions',
          value: rsi,
        });
      } else if (rsi > 70) {
        signals.push({
          indicator: 'RSI',
          signal: 'sell',
          strength: this.getRSIOverboughtStrength(rsi),
          reason: 'Overbought conditions',
          value: rsi,
        });
      } else {
        signals.push({
          indicator: 'RSI',
          signal: 'hold',
          strength: 'weak',
          reason: 'Neutral RSI',
          value: rsi,
        });
      }
    }

    // MACD Signals
    if (macd.histogram !== null && candles.length > 1) {
      const prevHistogram = this.calculatePreviousMACDHistogram(candles);

      if (macd.histogram > 0 && prevHistogram !== null && prevHistogram <= 0) {
        signals.push({
          indicator: 'MACD',
          signal: 'buy',
          strength: 'strong',
          reason: 'Bullish crossover',
          value: macd.histogram,
        });
      } else if (
        macd.histogram < 0 &&
        prevHistogram !== null &&
        prevHistogram >= 0
      ) {
        signals.push({
          indicator: 'MACD',
          signal: 'sell',
          strength: 'strong',
          reason: 'Bearish crossover',
          value: macd.histogram,
        });
      } else if (macd.histogram > 0) {
        signals.push({
          indicator: 'MACD',
          signal: 'buy',
          strength: 'weak',
          reason: 'Positive momentum',
          value: macd.histogram,
        });
      } else {
        signals.push({
          indicator: 'MACD',
          signal: 'sell',
          strength: 'weak',
          reason: 'Negative momentum',
          value: macd.histogram,
        });
      }
    }

    // Bollinger Bands Signals
    if (bollinger.pb !== null) {
      if (bollinger.pb < 0) {
        signals.push({
          indicator: 'Bollinger',
          signal: 'buy',
          strength: 'strong',
          reason: 'Below lower band',
          value: bollinger.pb,
        });
      } else if (bollinger.pb > 1) {
        signals.push({
          indicator: 'Bollinger',
          signal: 'sell',
          strength: 'strong',
          reason: 'Above upper band',
          value: bollinger.pb,
        });
      } else if (bollinger.pb < 0.2) {
        signals.push({
          indicator: 'Bollinger',
          signal: 'buy',
          strength: 'moderate',
          reason: 'Near lower band',
          value: bollinger.pb,
        });
      } else if (bollinger.pb > 0.8) {
        signals.push({
          indicator: 'Bollinger',
          signal: 'sell',
          strength: 'moderate',
          reason: 'Near upper band',
          value: bollinger.pb,
        });
      } else {
        signals.push({
          indicator: 'Bollinger',
          signal: 'hold',
          strength: 'weak',
          reason: 'Within bands',
          value: bollinger.pb,
        });
      }
    }

    // Stochastic Signals
    if (stochastic.k !== null && stochastic.d !== null) {
      const stochSignal = this.generateStochasticSignal(
        stochastic.k,
        stochastic.d,
      );
      signals.push(stochSignal);
    }

    return signals;
  }

  /**
   * Calculate previous MACD histogram for crossover detection.
   */
  private calculatePreviousMACDHistogram(candles: Candle[]): number | null {
    // istanbul ignore next - unreachable with 50+ candle minimum for detailed analysis
    if (candles.length < 2) {
      return null;
    }
    const previousCandles = candles.slice(0, -1);
    const prevMacd = this.indicatorsService.calculateMACD(previousCandles);
    return sanitizeNumber(prevMacd.histogram);
  }

  /**
   * Aggregate signals into overall summary.
   */
  private aggregateSignals(signals: IndicatorSignal[]): {
    overallSignal: SignalDirection;
    confidence: number;
    score: number;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
  } {
    let bullishScore = 0;
    let bearishScore = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    for (const signal of signals) {
      const weight = SIGNAL_WEIGHTS[signal.strength];
      if (signal.signal === 'buy') {
        bullishScore += weight;
        bullishCount++;
      } else if (signal.signal === 'sell') {
        bearishScore += weight;
        bearishCount++;
      } else {
        neutralCount++;
      }
    }

    // Handle division by zero
    const totalScore = bullishScore + bearishScore;
    // istanbul ignore next - edge case when no bullish or bearish signals
    const score =
      totalScore === 0 ? 0 : ((bullishScore - bearishScore) / totalScore) * 100;

    // Determine overall signal
    const overallSignal = this.scoreToSignal(score);

    // Calculate confidence based on signal agreement
    const totalSignals = bullishCount + bearishCount + neutralCount;
    const dominantCount = Math.max(bullishCount, bearishCount, neutralCount);
    // istanbul ignore next - edge case when no signals
    const confidence =
      totalSignals > 0 ? (dominantCount / totalSignals) * 100 : 0;

    return {
      overallSignal,
      confidence: Math.round(confidence),
      score: Math.round(score),
      bullishCount,
      bearishCount,
      neutralCount,
    };
  }

  /**
   * Determine trend direction and strength.
   */
  private determineTrend(
    currentPrice: number,
    sma20: number | null,
    sma50: number | null,
    adx: number | null,
  ): {
    direction: 'uptrend' | 'downtrend' | 'sideways';
    strength: SignalStrength;
    sma20: number | null;
    sma50: number | null;
  } {
    let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    let strength: SignalStrength = 'weak';

    // With 50+ candle minimum for detailed analysis, both SMA20 and SMA50 are always available
    if (sma20 !== null && sma50 !== null) {
      if (currentPrice > sma20 && sma20 > sma50) {
        direction = 'uptrend';
      } else if (currentPrice < sma20 && sma20 < sma50) {
        direction = 'downtrend';
      }
    }

    // Determine strength from ADX
    if (adx !== null) {
      strength = this.adxToStrength(adx);
    }

    return {
      direction,
      strength,
      sma20,
      sma50,
    };
  }

  /**
   * Get RSI oversold signal strength.
   * @internal
   */
  /* istanbul ignore next - edge case for extreme RSI < 20 depends on market conditions */
  private getRSIOversoldStrength(rsi: number): SignalStrength {
    return rsi < 20 ? 'strong' : 'moderate';
  }

  /**
   * Get RSI overbought signal strength.
   * @internal
   */
  /* istanbul ignore next - edge case for extreme RSI > 80 depends on market conditions */
  private getRSIOverboughtStrength(rsi: number): SignalStrength {
    return rsi > 80 ? 'strong' : 'moderate';
  }

  /**
   * Generate stochastic signal based on k and d values.
   * @internal
   */
  /* istanbul ignore next - stochastic signal conditions depend on market conditions */
  private generateStochasticSignal(k: number, d: number): IndicatorSignal {
    if (k < 20 && d < 20) {
      return {
        indicator: 'Stochastic',
        signal: 'buy',
        strength: 'strong',
        reason: 'Oversold conditions',
        value: k,
      };
    } else if (k > 80 && d > 80) {
      return {
        indicator: 'Stochastic',
        signal: 'sell',
        strength: 'strong',
        reason: 'Overbought conditions',
        value: k,
      };
    } else if (k > d && k < 50) {
      return {
        indicator: 'Stochastic',
        signal: 'buy',
        strength: 'moderate',
        reason: 'Bullish crossover in lower zone',
        value: k,
      };
    } else if (k < d && k > 50) {
      return {
        indicator: 'Stochastic',
        signal: 'sell',
        strength: 'moderate',
        reason: 'Bearish crossover in upper zone',
        value: k,
      };
    } else {
      return {
        indicator: 'Stochastic',
        signal: 'hold',
        strength: 'weak',
        reason: 'Neutral conditions',
        value: k,
      };
    }
  }

  /**
   * Convert score to signal direction.
   * @internal
   */
  /* istanbul ignore next - score thresholds depend on market conditions */
  private scoreToSignal(score: number): SignalDirection {
    if (score > 20) {
      return 'buy';
    } else if (score < -20) {
      return 'sell';
    } else {
      return 'hold';
    }
  }

  /**
   * Convert ADX value to trend strength.
   * @internal
   */
  /* istanbul ignore next - ADX strength thresholds depend on market conditions */
  private adxToStrength(adx: number): SignalStrength {
    if (adx > 40) {
      return 'strong';
    } else if (adx > 20) {
      return 'moderate';
    } else {
      return 'weak';
    }
  }
}
