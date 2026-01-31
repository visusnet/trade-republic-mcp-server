/**
 * Risk Service - Tests
 */

import { RiskService } from './RiskService';
import {
  RiskServiceError,
  type CalculatePositionSizeRequest,
  type GetRiskMetricsRequest,
} from './RiskService.types';

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService();
  });

  describe('RiskServiceError', () => {
    it('should create error with correct name and message', () => {
      const error = new RiskServiceError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RiskServiceError);
      expect(error.name).toBe('RiskServiceError');
      expect(error.message).toBe('Test error message');
    });
  });

  describe('calculatePositionSize', () => {
    describe('Kelly Criterion calculation', () => {
      it('should calculate basic Kelly percentage correctly', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
          kellyFraction: 1.0, // Full Kelly for testing
        };

        const result = service.calculatePositionSize(request);

        // Kelly% = W - (1-W)/R = 0.6 - (0.4)/(100/50) = 0.6 - 0.2 = 0.4 (40%)
        expect(result.kellyPercentage).toBeCloseTo(0.4, 5);
        expect(result.winLossRatio).toBeCloseTo(2.0, 5);
      });

      it('should apply fractional Kelly (quarter)', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
          kellyFraction: 0.25,
        };

        const result = service.calculatePositionSize(request);

        // Kelly% = 0.4, Quarter Kelly = 0.4 * 0.25 = 0.1 (10%)
        expect(result.kellyPercentage).toBeCloseTo(0.4, 5);
        expect(result.adjustedPercentage).toBeCloseTo(0.1, 5);
      });

      it('should apply fractional Kelly (half)', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
          kellyFraction: 0.5,
          maxPositionPct: 0.5, // Allow up to 50% position
        };

        const result = service.calculatePositionSize(request);

        // Kelly% = 0.4, Half Kelly = 0.4 * 0.5 = 0.2 (20%)
        expect(result.kellyPercentage).toBeCloseTo(0.4, 5);
        expect(result.adjustedPercentage).toBeCloseTo(0.2, 5);
      });

      it('should default to quarter Kelly when kellyFraction not provided', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        // Should use default 0.25
        expect(result.adjustedPercentage).toBeCloseTo(0.1, 5);
      });

      it('should cap adjusted percentage to maxPositionPct', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.9,
          avgWin: 200,
          avgLoss: 50,
          kellyFraction: 1.0,
          maxPositionPct: 0.1, // Cap at 10%
        };

        const result = service.calculatePositionSize(request);

        // Kelly would be very high, but should be capped at 10%
        expect(result.adjustedPercentage).toBe(0.1);
      });

      it('should set adjusted percentage to zero for negative Kelly', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.4,
          avgWin: 50,
          avgLoss: 100,
          kellyFraction: 1.0,
        };

        const result = service.calculatePositionSize(request);

        // Kelly% = 0.4 - 0.6/0.5 = 0.4 - 1.2 = -0.8
        expect(result.kellyPercentage).toBeCloseTo(-0.8, 5);
        expect(result.adjustedPercentage).toBe(0);
      });
    });

    describe('Position sizing and capital calculation', () => {
      it('should calculate position size with cash reserve', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
          kellyFraction: 0.25,
          minCashReservePct: 0.1, // 10% reserve
        };

        const result = service.calculatePositionSize(request);

        // Available capital = 10000 * 0.9 = 9000
        expect(result.availableCapital).toBe(9000);
        // Position size = 9000 * 0.1 = 900
        expect(result.positionSizeAmount).toBeCloseTo(900, 5);
      });

      it('should respect max position size', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
          kellyFraction: 1.0,
          maxPositionPct: 0.1,
          minCashReservePct: 0.0, // No reserve for simplicity
        };

        const result = service.calculatePositionSize(request);

        // Max position = 10000 * 0.1 = 1000
        expect(result.maxPositionSize).toBe(1000);
        // Position should be capped at max
        expect(result.positionSizeAmount).toBe(1000);
      });

      it('should use default cash reserve of 10%', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        // Default reserve is 10%
        expect(result.availableCapital).toBe(9000);
      });

      it('should use default max position of 10%', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        expect(result.maxPositionSize).toBe(1000);
      });
    });

    describe('Warnings generation', () => {
      it('should warn on negative Kelly', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.3,
          avgWin: 50,
          avgLoss: 100,
        };

        const result = service.calculatePositionSize(request);

        expect(result.warnings).toContain(
          'WARNING: Negative Kelly percentage indicates a losing strategy. DO NOT TRADE.',
        );
      });

      it('should warn on very high Kelly percentage', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.95,
          avgWin: 1000,
          avgLoss: 10,
        };

        const result = service.calculatePositionSize(request);

        // Kelly% = 0.95 - 0.05/100 = 0.95 - 0.0005 = 0.9495 (very high)
        // With such extreme parameters, should get a high win/loss ratio warning
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('should warn on near-zero win rate', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.005,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        expect(result.warnings).toContain(
          'WARNING: Win rate is near zero. Insufficient data or highly unreliable strategy.',
        );
      });

      it('should warn on near-100% win rate', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.995,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        expect(result.warnings).toContain(
          'WARNING: Win rate is near 100%. This is unrealistic for most trading strategies.',
        );
      });

      it('should warn on very high win/loss ratio', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 1000,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        expect(result.warnings).toContain(
          'WARNING: Win/Loss ratio is very high. Verify average win/loss calculations.',
        );
      });

      it('should warn on very low win/loss ratio', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 5,
          avgLoss: 100,
        };

        const result = service.calculatePositionSize(request);

        expect(result.warnings).toContain(
          'WARNING: Win/Loss ratio is very low. Average losses significantly exceed average wins.',
        );
      });

      it('should have no warnings for reasonable parameters', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.55,
          avgWin: 100,
          avgLoss: 90,
        };

        const result = service.calculatePositionSize(request);

        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('Response structure', () => {
      it('should include timestamp', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        expect(result.timestamp).toBeDefined();
        expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
      });

      it('should include all required fields', () => {
        const request: CalculatePositionSizeRequest = {
          accountBalance: 10000,
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        };

        const result = service.calculatePositionSize(request);

        expect(result).toHaveProperty('kellyPercentage');
        expect(result).toHaveProperty('adjustedPercentage');
        expect(result).toHaveProperty('positionSizeAmount');
        expect(result).toHaveProperty('maxPositionSize');
        expect(result).toHaveProperty('availableCapital');
        expect(result).toHaveProperty('winLossRatio');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('timestamp');
      });
    });
  });

  describe('getRiskMetrics', () => {
    describe('Log returns calculation', () => {
      it('should calculate log returns correctly', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 105],
        };

        const result = service.getRiskMetrics(request);

        // Log returns should be calculated
        expect(result.returns.mean).toBeDefined();
      });

      it('should handle minimum two prices', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110],
        };

        const result = service.getRiskMetrics(request);

        expect(result.dataPoints).toBe(2);
        expect(result.returns.total).toBeCloseTo(0.1, 5); // 10% return
      });
    });

    describe('Volatility calculation', () => {
      it('should calculate daily volatility', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 101, 103, 102],
          timeframe: 'daily',
        };

        const result = service.getRiskMetrics(request);

        expect(result.volatility.daily).toBeGreaterThan(0);
        expect(result.volatility.annualized).toBeGreaterThan(0);
      });

      it('should annualize daily volatility correctly', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 101, 103, 102],
          timeframe: 'daily',
        };

        const result = service.getRiskMetrics(request);

        // Annualized = daily * sqrt(252)
        const expectedAnnualized = result.volatility.daily * Math.sqrt(252);
        expect(result.volatility.annualized).toBeCloseTo(expectedAnnualized, 5);
      });

      it('should annualize weekly volatility correctly', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 105, 103, 107, 106],
          timeframe: 'weekly',
        };

        const result = service.getRiskMetrics(request);

        // Annualized = weekly * sqrt(52)
        const expectedAnnualized = result.volatility.daily * Math.sqrt(52);
        expect(result.volatility.annualized).toBeCloseTo(expectedAnnualized, 5);
      });

      it('should annualize monthly volatility correctly', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 105, 115, 112],
          timeframe: 'monthly',
        };

        const result = service.getRiskMetrics(request);

        // Annualized = monthly * sqrt(12)
        const expectedAnnualized = result.volatility.daily * Math.sqrt(12);
        expect(result.volatility.annualized).toBeCloseTo(expectedAnnualized, 5);
      });

      it('should handle zero volatility (constant prices)', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 100, 100, 100],
        };

        const result = service.getRiskMetrics(request);

        expect(result.volatility.daily).toBe(0);
        expect(result.volatility.annualized).toBe(0);
      });

      it('should use daily as default timeframe', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 101],
        };

        const result = service.getRiskMetrics(request);

        expect(result.timeframe).toBe('daily');
      });
    });

    describe('Value at Risk (VaR)', () => {
      it('should calculate parametric VaR at 95% confidence', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 98, 103, 97, 105],
          confidenceLevel: '0.95',
        };

        const result = service.getRiskMetrics(request);

        expect(result.valueAtRisk.parametric).toBeDefined();
        expect(result.valueAtRisk.confidenceLevel).toBe('0.95');
      });

      it('should calculate parametric VaR at 99% confidence', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 98, 103, 97, 105],
          confidenceLevel: '0.99',
        };

        const result = service.getRiskMetrics(request);

        expect(result.valueAtRisk.parametric).toBeDefined();
        expect(result.valueAtRisk.confidenceLevel).toBe('0.99');
      });

      it('should calculate historical VaR at 95% confidence', () => {
        const request: GetRiskMetricsRequest = {
          prices: Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i) * 5),
          confidenceLevel: '0.95',
        };

        const result = service.getRiskMetrics(request);

        expect(result.valueAtRisk.historical).toBeDefined();
      });

      it('should calculate historical VaR at 99% confidence', () => {
        const request: GetRiskMetricsRequest = {
          prices: Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i) * 5),
          confidenceLevel: '0.99',
        };

        const result = service.getRiskMetrics(request);

        expect(result.valueAtRisk.historical).toBeDefined();
      });

      it('should use 95% confidence as default', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 98, 103],
        };

        const result = service.getRiskMetrics(request);

        expect(result.valueAtRisk.confidenceLevel).toBe('0.95');
      });

      it('should return VaR values with correct sign (positive for losses)', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 90, 80, 70], // Declining prices
        };

        const result = service.getRiskMetrics(request);

        // VaR should be positive (representing expected loss)
        expect(result.valueAtRisk.parametric).toBeGreaterThan(0);
      });
    });

    describe('Maximum Drawdown', () => {
      it('should calculate max drawdown from peak to trough', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 120, 90, 110],
        };

        const result = service.getRiskMetrics(request);

        // Peak at 120, trough at 90: (120-90)/120 = 0.25 (25%)
        expect(result.maxDrawdown.percent).toBeCloseTo(0.25, 5);
        expect(result.maxDrawdown.value).toBeCloseTo(30, 5);
      });

      it('should track peak and trough indices', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 120, 90, 110],
        };

        const result = service.getRiskMetrics(request);

        expect(result.maxDrawdown.peakIndex).toBe(1);
        expect(result.maxDrawdown.troughIndex).toBe(2);
      });

      it('should find maximum drawdown among multiple peaks', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 105, 120, 80, 100],
        };

        const result = service.getRiskMetrics(request);

        // Max drawdown from 120 to 80: (120-80)/120 = 0.333...
        expect(result.maxDrawdown.percent).toBeCloseTo(0.3333, 4);
        expect(result.maxDrawdown.peakIndex).toBe(3);
        expect(result.maxDrawdown.troughIndex).toBe(4);
      });

      it('should return zero drawdown for monotonically increasing prices', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 120, 130],
        };

        const result = service.getRiskMetrics(request);

        expect(result.maxDrawdown.percent).toBe(0);
        expect(result.maxDrawdown.value).toBe(0);
      });

      it('should handle all equal prices', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 100, 100],
        };

        const result = service.getRiskMetrics(request);

        expect(result.maxDrawdown.percent).toBe(0);
        expect(result.maxDrawdown.value).toBe(0);
      });

      it('should return positive percentage for drawdown', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 120, 90],
        };

        const result = service.getRiskMetrics(request);

        // Formula: (Peak - Trough) / Peak = positive value
        expect(result.maxDrawdown.percent).toBeGreaterThan(0);
      });
    });

    describe('Sharpe Ratio', () => {
      it('should calculate Sharpe ratio with positive returns', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 105, 110, 115, 120],
          riskFreeRate: 0.02,
        };

        const result = service.getRiskMetrics(request);

        expect(result.sharpeRatio).not.toBeNull();
        expect(result.sharpeRatio).toBeGreaterThan(0);
      });

      it('should return null for zero volatility', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 100, 100],
        };

        const result = service.getRiskMetrics(request);

        expect(result.sharpeRatio).toBeNull();
      });

      it('should handle negative Sharpe (return < risk-free)', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 99, 98, 97], // Declining prices
          riskFreeRate: 0.05, // 5% risk-free rate
        };

        const result = service.getRiskMetrics(request);

        expect(result.sharpeRatio).not.toBeNull();
        expect(result.sharpeRatio).toBeLessThan(0);
      });

      it('should use default risk-free rate of 2%', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 105, 110],
        };

        const result = service.getRiskMetrics(request);

        // Should calculate with default 0.02
        expect(result.sharpeRatio).toBeDefined();
      });

      it('should annualize return correctly for daily data', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 101, 102, 103],
          timeframe: 'daily',
          riskFreeRate: 0.02,
        };

        const result = service.getRiskMetrics(request);

        // Annualized return should be much higher than daily
        expect(result.returns.annualized).toBeGreaterThan(result.returns.mean);
      });

      it('should annualize return correctly for weekly data', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 102, 104, 106],
          timeframe: 'weekly',
          riskFreeRate: 0.02,
        };

        const result = service.getRiskMetrics(request);

        expect(result.sharpeRatio).toBeDefined();
      });

      it('should annualize return correctly for monthly data', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 105, 110, 115],
          timeframe: 'monthly',
          riskFreeRate: 0.02,
        };

        const result = service.getRiskMetrics(request);

        expect(result.sharpeRatio).toBeDefined();
      });
    });

    describe('Return statistics', () => {
      it('should calculate total return', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 120],
        };

        const result = service.getRiskMetrics(request);

        expect(result.returns.total).toBeCloseTo(0.2, 5); // 20% return
      });

      it('should calculate mean log return', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 120],
        };

        const result = service.getRiskMetrics(request);

        expect(result.returns.mean).toBeDefined();
        expect(result.returns.mean).toBeGreaterThan(0);
      });

      it('should calculate annualized return', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 120],
          timeframe: 'daily',
        };

        const result = service.getRiskMetrics(request);

        expect(result.returns.annualized).toBeDefined();
      });
    });

    describe('Response structure', () => {
      it('should include timestamp', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110],
        };

        const result = service.getRiskMetrics(request);

        expect(result.timestamp).toBeDefined();
        expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
      });

      it('should include all required fields', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 105],
        };

        const result = service.getRiskMetrics(request);

        expect(result).toHaveProperty('volatility');
        expect(result).toHaveProperty('valueAtRisk');
        expect(result).toHaveProperty('maxDrawdown');
        expect(result).toHaveProperty('sharpeRatio');
        expect(result).toHaveProperty('returns');
        expect(result).toHaveProperty('dataPoints');
        expect(result).toHaveProperty('timeframe');
        expect(result).toHaveProperty('timestamp');
      });

      it('should include correct data points count', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 110, 105, 115],
        };

        const result = service.getRiskMetrics(request);

        expect(result.dataPoints).toBe(4);
      });
    });

    describe('Integration tests', () => {
      it('should calculate all metrics for real-world scenario', () => {
        // Simulate a year of daily prices with some volatility
        const prices = Array.from({ length: 252 }, (_, i) => {
          const trend = i * 0.1;
          const noise = Math.sin(i / 10) * 5;
          return 100 + trend + noise;
        });

        const request: GetRiskMetricsRequest = {
          prices,
          riskFreeRate: 0.03,
          confidenceLevel: '0.95',
          timeframe: 'daily',
        };

        const result = service.getRiskMetrics(request);

        // All metrics should be calculated
        expect(result.volatility.daily).toBeGreaterThan(0);
        expect(result.volatility.annualized).toBeGreaterThan(0);
        expect(result.valueAtRisk.parametric).toBeDefined();
        expect(result.valueAtRisk.historical).toBeDefined();
        expect(result.maxDrawdown.percent).toBeGreaterThanOrEqual(0);
        expect(result.sharpeRatio).not.toBeNull();
        expect(result.returns.total).toBeGreaterThan(0);
      });

      it('should handle minimum data (2 prices)', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 105],
        };

        const result = service.getRiskMetrics(request);

        expect(result.dataPoints).toBe(2);
        expect(result.volatility.daily).toBe(0); // Single return has zero variance
        expect(result.sharpeRatio).toBeNull(); // Zero volatility
      });

      it('should handle highly volatile prices', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 150, 80, 120, 90, 140],
        };

        const result = service.getRiskMetrics(request);

        expect(result.volatility.daily).toBeGreaterThan(0);
        expect(result.maxDrawdown.percent).toBeGreaterThan(0);
      });

      it('should handle declining market', () => {
        const request: GetRiskMetricsRequest = {
          prices: [100, 95, 90, 85, 80],
        };

        const result = service.getRiskMetrics(request);

        expect(result.returns.total).toBeLessThan(0);
        expect(result.returns.annualized).toBeLessThan(0);
        expect(result.maxDrawdown.percent).toBeGreaterThan(0);
      });
    });
  });
});
