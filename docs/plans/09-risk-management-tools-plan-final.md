# Task 09: Risk Management Tools - Final Implementation Plan

**Plan Status**: CORRECTED - Multiple critical issues found and fixed during verification

## Verification Issues Found and Corrected

### Critical Issues Fixed:
1. **Z-score errors**: Corrected 0.90 confidence (1.645→1.28) and 0.95 confidence (1.96→1.645)
2. **VaR formula error**: Fixed parametric VaR formula direction (was backward)
3. **Missing validation**: Added comprehensive input validation and edge case handling
4. **Test coverage gaps**: Expanded TDD test cases to ensure 100% coverage
5. **Schema improvements**: Enhanced schemas with better validation and defaults
6. **Error handling**: Added proper error classes and validation

## 1. Overview

Implement **RiskService** with two MCP tools:
- `calculate_position_size` - Kelly Criterion-based position sizing
- `get_risk_metrics` - Risk metrics (volatility, VaR, max drawdown, Sharpe ratio)

**Key Decision**: This is a **pure calculation service** - no external APIs, no data fetching. Caller provides price/return data. This follows YAGNI and SRP principles

**Key Decision**: This is a **pure calculation service** - no external APIs, no data fetching. Caller provides price/return data. This follows the pattern of TechnicalIndicatorsService and aligns with YAGNI and SRP.

## 2. Kelly Criterion

**Formula**: `Kelly % = W - [(1-W) / R]`
- W = Win rate (0.0 to 1.0)
- R = Win/Loss ratio (average win / average loss)

**Mathematical Verification**: Correct. This is the standard Kelly formula for trading.

**Fractional Kelly**:
- Full Kelly: Use raw percentage (aggressive, not recommended)
- Half Kelly: Kelly% × 0.5 (balanced)
- Quarter Kelly: Kelly% × 0.25 (conservative, **recommended default**)

**Safety Caps**:
- Maximum position percentage (default: 10%)
- Minimum cash reserve (default: 10%)
- **Warning for negative Kelly** (system has negative edge - DO NOT TRADE)
- **Warning for Kelly > 100%** (unrealistic, cap to max position)
- **Warning for zero win rate or loss rate** (insufficient data)

## 3. Risk Metrics

### 3.1 Volatility

**Method**: Standard deviation of **log returns**
- Log returns: `ln(P_t / P_{t-1})`
- Daily volatility: σ_daily = std(log_returns)
- Annualized volatility depends on timeframe:
  - Daily: σ_annual = σ_daily × √252
  - Weekly: σ_annual = σ_weekly × √52
  - Monthly: σ_annual = σ_monthly × √12

**Rationale**: Log returns are time-additive and normally distributed, making them appropriate for volatility calculations.

### 3.2 Value at Risk (VaR)

Two methods:

1. **Parametric VaR**: VaR = -(μ + z × σ)
   - μ = mean return
   - σ = standard deviation of returns
   - z = **one-tailed** z-score (negative for losses):
     - 95% confidence: z = -1.645
     - 99% confidence: z = -2.326 (commonly 2.33)
   - Returns negative value representing expected loss

2. **Historical VaR**: Percentile cutoff of actual returns
   - Sort returns ascending
   - 95% VaR: 5th percentile
   - 99% VaR: 1st percentile
   - Returns the actual historical loss at that confidence level

**Note**: VaR uses **one-tailed** z-scores because we only care about downside risk.

### 3.3 Maximum Drawdown

**Formula**: `MDD = (Peak - Trough) / Peak`
- Peak: Highest price reached before decline
- Trough: Lowest price during decline
- Result: Positive percentage representing maximum loss from peak
- Track both peak and trough indices for analysis

**Example**: Price goes from 100 (peak) to 80 (trough): MDD = (100-80)/100 = 20%

### 3.4 Sharpe Ratio

**Formula**: `Sharpe = (R_annual - R_f) / σ_annual`
- R_annual = Annualized portfolio return
- R_f = Annual risk-free rate (input parameter, default 0.02)
- σ_annual = Annualized volatility

**Calculation Steps**:
1. Calculate mean log return: μ_log
2. Annualize return: R_annual = exp(μ_log × periods_per_year) - 1
3. Get annualized volatility: σ_annual
4. Sharpe = (R_annual - R_f) / σ_annual

**Special Cases**:
- Return `null` if volatility is zero (avoid division by zero)
- Return `null` if insufficient data

**Interpretation**:
- Sharpe > 1: Good risk-adjusted return
- Sharpe > 2: Very good
- Sharpe > 3: Excellent

## 4. File Structure

```
src/server/services/
├── RiskService.ts                 # Main service (follows TechnicalIndicatorsService pattern)
├── RiskService.spec.ts            # Tests (70-90 tests)
└── RiskService.types.ts           # Types, errors, request/response schemas

src/server/tools/
├── RiskManagementToolRegistry.ts      # Tool registration
├── RiskManagementToolRegistry.spec.ts # Tests (10-15 tests)
└── index.ts                           # Updated exports
```

**Rationale**: Since RiskService is a pure calculation service like TechnicalIndicatorsService, we consolidate request/response schemas into the types file rather than creating separate files.

## 5. Request/Response Schemas (in RiskService.types.ts)

### CalculatePositionSizeRequestSchema

```typescript
export const CalculatePositionSizeRequestSchema = z.object({
  accountBalance: z.number().positive().describe('Total account balance in EUR'),
  winRate: z.number().min(0).max(1).describe('Historical win rate (0.0 to 1.0)'),
  avgWin: z.number().positive().describe('Average winning trade amount in EUR'),
  avgLoss: z.number().positive().describe('Average losing trade amount in EUR'),
  kellyFraction: z.number().min(0.1).max(1.0).default(0.25).optional()
    .describe('Fraction of Kelly (0.25=quarter, 0.5=half, 1.0=full). Default: 0.25 (recommended)'),
  maxPositionPct: z.number().min(0).max(1).default(0.10).optional()
    .describe('Maximum position size as fraction of account. Default: 0.10 (10%)'),
  minCashReservePct: z.number().min(0).max(1).default(0.10).optional()
    .describe('Minimum cash reserve as fraction of account. Default: 0.10 (10%)'),
});

export type CalculatePositionSizeRequest = z.infer<typeof CalculatePositionSizeRequestSchema>;
```

### CalculatePositionSizeResponseSchema

```typescript
export const CalculatePositionSizeResponseSchema = z.object({
  kellyPercentage: z.number().describe('Raw Kelly percentage'),
  adjustedPercentage: z.number().describe('After applying Kelly fraction and caps'),
  positionSizeAmount: z.number().describe('Recommended position size in EUR'),
  maxPositionSize: z.number().describe('Maximum allowed position size in EUR'),
  availableCapital: z.number().describe('Available capital after cash reserve in EUR'),
  winLossRatio: z.number().describe('Win/Loss ratio used in calculation'),
  warnings: z.array(z.string()).describe('Warning messages if any'),
  timestamp: z.string().datetime(),
});

export type CalculatePositionSizeResponse = z.infer<typeof CalculatePositionSizeResponseSchema>;
```

### GetRiskMetricsRequestSchema

```typescript
export const GetRiskMetricsRequestSchema = z.object({
  prices: z.array(z.number().positive()).min(2)
    .describe('Historical prices (chronological, oldest first)'),
  riskFreeRate: z.number().min(0).max(1).default(0.02).optional()
    .describe('Annual risk-free rate for Sharpe ratio. Default: 0.02 (2%)'),
  confidenceLevel: z.enum(['0.95', '0.99']).default('0.95').optional()
    .describe('Confidence level for VaR. Default: 0.95 (95%)'),
  timeframe: z.enum(['daily', 'weekly', 'monthly']).default('daily').optional()
    .describe('Timeframe of price data for annualization. Default: daily'),
});

export type GetRiskMetricsRequest = z.infer<typeof GetRiskMetricsRequestSchema>;
```

**Note**: Changed confidenceLevel to enum of strings to avoid floating-point comparison issues.

### GetRiskMetricsResponseSchema

```typescript
export const GetRiskMetricsResponseSchema = z.object({
  volatility: z.object({
    daily: z.number().describe('Daily volatility (standard deviation of log returns)'),
    annualized: z.number().describe('Annualized volatility'),
  }),
  valueAtRisk: z.object({
    parametric: z.number().describe('Parametric VaR (negative value = expected loss)'),
    historical: z.number().describe('Historical VaR (negative value = expected loss)'),
    confidenceLevel: z.string().describe('Confidence level used (0.95 or 0.99)'),
  }),
  maxDrawdown: z.object({
    value: z.number().describe('Maximum drawdown in absolute price terms'),
    percent: z.number().describe('Maximum drawdown as percentage (positive value)'),
    peakIndex: z.number().int().describe('Index of peak price'),
    troughIndex: z.number().int().describe('Index of trough price'),
  }),
  sharpeRatio: z.number().nullable().describe('Annualized Sharpe ratio (null if zero volatility)'),
  returns: z.object({
    total: z.number().describe('Total return as percentage'),
    mean: z.number().describe('Mean log return'),
    annualized: z.number().describe('Annualized return as percentage'),
  }),
  dataPoints: z.number().int().describe('Number of price data points'),
  timeframe: z.enum(['daily', 'weekly', 'monthly']),
  timestamp: z.string().datetime(),
});

export type GetRiskMetricsResponse = z.infer<typeof GetRiskMetricsResponseSchema>;
```

## 6. Types and Constants (in RiskService.types.ts)

```typescript
export class RiskServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RiskServiceError';
  }
}

// Annualization factors
export const TRADING_DAYS_PER_YEAR = 252;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

// One-tailed z-scores for VaR (downside risk only)
export const VAR_Z_SCORES: Record<string, number> = {
  '0.95': -1.645,  // 95% confidence
  '0.99': -2.326,  // 99% confidence (often rounded to -2.33)
};

// Annualization periods mapping
export const PERIODS_PER_YEAR: Record<string, number> = {
  'daily': TRADING_DAYS_PER_YEAR,
  'weekly': WEEKS_PER_YEAR,
  'monthly': MONTHS_PER_YEAR,
};

// Internal result types
export interface VolatilityResult {
  daily: number;
  annualized: number;
}

export interface VaRResult {
  parametric: number;
  historical: number;
  confidenceLevel: string;
}

export interface MaxDrawdownResult {
  value: number;
  percent: number;
  peakIndex: number;
  troughIndex: number;
}
```

## 7. Service Implementation

```typescript
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
    const minCashReservePct = request.minCashReservePct ?? 0.10;
    const availableCapital = request.accountBalance * (1 - minCashReservePct);

    // 5. Apply max position cap
    const maxPositionPct = request.maxPositionPct ?? 0.10;
    const maxPositionSize = request.accountBalance * maxPositionPct;

    // Cap adjusted percentage
    if (adjustedPercentage > maxPositionPct) {
      adjustedPercentage = maxPositionPct;
    }
    if (adjustedPercentage < 0) {
      adjustedPercentage = 0;
    }

    // 6. Calculate final position size
    const positionSizeAmount = Math.min(
      availableCapital * adjustedPercentage,
      maxPositionSize,
    );

    // 7. Generate warnings
    const warnings = this.generateWarnings(
      kellyPercentage,
      adjustedPercentage,
      request.winRate,
      winLossRatio,
    );

    return {
      kellyPercentage,
      adjustedPercentage,
      positionSizeAmount,
      maxPositionSize,
      availableCapital,
      winLossRatio,
      warnings,
      timestamp: new Date().toISOString(),
    };
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
    const totalReturn = (request.prices[request.prices.length - 1] - request.prices[0]) / request.prices[0];
    const meanLogReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const periodsPerYear = PERIODS_PER_YEAR[timeframe];
    const annualizedReturn = Math.exp(meanLogReturn * periodsPerYear) - 1;

    return {
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
    };
  }

  // Private calculation methods

  /**
   * Calculate Kelly percentage: W - (1-W)/R
   */
  private calculateKellyPercentage(winRate: number, winLossRatio: number): number {
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
  private calculateVolatility(returns: number[], timeframe: string): VolatilityResult;

  /**
   * Calculate Value at Risk using both parametric and historical methods.
   */
  private calculateVaR(returns: number[], confidenceLevel: string): VaRResult;

  /**
   * Calculate maximum drawdown from peak to trough.
   */
  private calculateMaxDrawdown(prices: number[]): MaxDrawdownResult;

  /**
   * Calculate annualized Sharpe ratio.
   */
  private calculateSharpeRatio(
    returns: number[],
    annualizedVolatility: number,
    riskFreeRate: number,
    timeframe: string,
  ): number | null;

  /**
   * Generate warnings for position sizing.
   */
  private generateWarnings(
    kellyPercentage: number,
    adjustedPercentage: number,
    winRate: number,
    winLossRatio: number,
  ): string[];
}
```

## 8. TDD Implementation Order

### Phase 1: Setup (RED)
1. Create RiskService.types.ts with schemas and constants
2. Create RiskService.ts with class skeleton
3. Create RiskService.spec.ts

### Phase 2: Kelly Criterion (RED-GREEN-REFACTOR)
1. **Test**: Basic Kelly calculation with normal values → Implement `calculateKellyPercentage`
2. **Test**: Fractional Kelly (quarter, half, full) → Add fraction logic
3. **Test**: Position caps (max position, cash reserve) → Add capping logic
4. **Test**: Negative Kelly (losing system) → Add warning
5. **Test**: Kelly > 100% → Add capping and warning
6. **Test**: Edge cases (zero win rate, 100% win rate) → Add validation
7. **Test**: Full integration test → Verify `calculatePositionSize`

### Phase 3: Log Returns (RED-GREEN-REFACTOR)
1. **Test**: Simple log returns calculation → Implement `calculateLogReturns`
2. **Test**: Single price edge case → Handle gracefully
3. **Test**: Two prices minimum → Verify minimum data requirement

### Phase 4: Volatility (RED-GREEN-REFACTOR)
1. **Test**: Daily volatility calculation → Implement standard deviation
2. **Test**: Annualization (daily, weekly, monthly) → Add timeframe logic
3. **Test**: Zero volatility (constant prices) → Handle edge case
4. **Test**: Single return edge case → Handle gracefully

### Phase 5: VaR (RED-GREEN-REFACTOR)
1. **Test**: Parametric VaR at 95% → Implement formula with z-score
2. **Test**: Parametric VaR at 99% → Verify different confidence level
3. **Test**: Historical VaR at 95% → Implement percentile calculation
4. **Test**: Historical VaR at 99% → Verify different percentile
5. **Test**: Insufficient data for historical VaR → Handle gracefully
6. **Test**: Verify VaR values are negative → Validate sign convention

### Phase 6: Max Drawdown (RED-GREEN-REFACTOR)
1. **Test**: Simple drawdown (peak then decline) → Implement tracking
2. **Test**: Multiple peaks and troughs → Find maximum
3. **Test**: Peak/trough indices → Add index tracking
4. **Test**: No drawdown (monotonically increasing) → Return zero
5. **Test**: All prices equal → Handle edge case
6. **Test**: Verify formula: (Peak - Trough) / Peak → Validate positive percentage

### Phase 7: Sharpe Ratio (RED-GREEN-REFACTOR)
1. **Test**: Basic Sharpe with positive return → Implement formula
2. **Test**: Annualization (daily, weekly, monthly) → Add timeframe support
3. **Test**: Zero volatility → Return null
4. **Test**: Negative Sharpe (return < risk-free) → Verify negative values allowed
5. **Test**: Verify annualized return calculation → Validate exp(μ × periods) - 1

### Phase 8: Integration (RED-GREEN-REFACTOR)
1. **Test**: Full `getRiskMetrics` with real-world data
2. **Test**: All metrics together
3. **Test**: Edge cases (minimum data, constant prices)

### Phase 9: Tool Registry (RED-GREEN-REFACTOR)
1. **Test**: Tool registration → Create RiskManagementToolRegistry
2. **Test**: Handler execution for calculate_position_size
3. **Test**: Handler execution for get_risk_metrics
4. **Test**: Schema validation (valid and invalid inputs)

### Phase 10: Server Integration
1. Update TradeRepublicMcpServer.ts to register RiskManagementToolRegistry
2. Update exports in src/server/tools/index.ts
3. Run full test suite and verify 100% coverage

## 9. Dependencies

**No new npm packages required.**

Uses existing:
- `zod` - Schema validation
- Native JavaScript `Math` functions for all calculations

## 10. Success Criteria

- [ ] 2 tools registered: `calculate_position_size`, `get_risk_metrics`
- [ ] 100% test coverage with 80-105 tests total
- [ ] Kelly Criterion correctly implemented: W - (1-W)/R
- [ ] Fractional Kelly support (0.25, 0.5, 1.0)
- [ ] Log returns used for volatility calculations
- [ ] Volatility with correct annualization (√252, √52, √12)
- [ ] VaR with one-tailed z-scores (-1.645 for 95%, -2.326 for 99%)
- [ ] Both parametric and historical VaR
- [ ] Maximum drawdown with correct formula: (Peak - Trough) / Peak
- [ ] Peak and trough index tracking
- [ ] Sharpe ratio with proper annualization
- [ ] Sharpe returns null for zero volatility
- [ ] Clear warning messages for risky parameters
- [ ] No external dependencies or API calls
- [ ] Follows TechnicalIndicatorsService pattern (pure calculation service)
- [ ] Uses `public` visibility modifiers for public methods
- [ ] All schemas validated with Zod
- [ ] All formulas mathematically verified

## 11. Mathematical Verification Summary

✓ Kelly Criterion: `W - (1-W)/R` - **CORRECT**
✓ Max Drawdown: Changed to `(Peak - Trough) / Peak` - **CORRECTED** (was backwards)
✓ VaR Z-Scores: Changed to one-tailed values - **CORRECTED**
✓ Log Returns: Explicitly specified `ln(P_t / P_{t-1})` - **CLARIFIED**
✓ Sharpe Ratio: Added annualization details - **CLARIFIED**
✓ Volatility: Annualization factors verified - **CORRECT**

## 12. Key Corrections from Combined Plan

1. **VaR Z-Scores**: Changed from two-tailed to one-tailed (95% = -1.645, 99% = -2.326)
2. **Max Drawdown Formula**: Corrected sign to `(Peak - Trough) / Peak` for positive percentage
3. **Returns Calculation**: Specified log returns explicitly
4. **Sharpe Ratio**: Clarified annualization methodology
5. **File Structure**: Simplified to match TechnicalIndicatorsService pattern
6. **Confidence Level**: Changed to string enum to avoid floating-point issues
7. **Warning Generation**: Added more specific edge cases
8. **Formula Documentation**: Added mathematical verification and examples
