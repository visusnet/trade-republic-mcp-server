# Task 09: Risk Management Tools - Combined Implementation Plan

## 1. Overview

Implement **RiskService** with two MCP tools:
- `calculate_position_size` - Kelly Criterion-based position sizing
- `get_risk_metrics` - Risk metrics (volatility, VaR, max drawdown, Sharpe ratio)

**Key Decision**: This is a **pure calculation service** - no external APIs, no data fetching. Caller provides price/return data. This follows Agent 1's approach as it aligns with YAGNI and SRP.

## 2. Kelly Criterion

**Formula**: `Kelly % = W - [(1-W) / R]`
- W = Win rate (0.0 to 1.0)
- R = Win/Loss ratio (average win / average loss)

**Fractional Kelly** (from both plans):
- Full Kelly: Use raw percentage (aggressive)
- Half Kelly: Kelly% × 0.5 (balanced)
- Quarter Kelly: Kelly% × 0.25 (conservative, recommended)

**Safety Caps**:
- Maximum position percentage (default: 10-25%)
- Minimum cash reserve (default: 10%)
- Warning for negative Kelly (don't trade)

## 3. Risk Metrics

### 3.1 Volatility
- Daily: Standard deviation of returns
- Annualized: σ_daily × √252

### 3.2 Value at Risk (VaR)
Two methods (Agent 1 approach):
1. **Parametric**: VaR = μ - (z × σ)
   - 95% confidence: z = 1.645
   - 99% confidence: z = 2.33
2. **Historical**: Percentile cutoff of actual returns

### 3.3 Maximum Drawdown
- MDD = (Trough - Peak) / Peak
- Track peak index and trough index
- Return both value and percentage

### 3.4 Sharpe Ratio
- Formula: (R_portfolio - R_riskfree) / σ_portfolio
- Annualized for comparison
- Return null if zero volatility

## 4. File Structure

```
src/server/services/
├── RiskService.ts                 # Main service
├── RiskService.spec.ts            # Tests (60-80 tests)
├── RiskService.request.ts         # Request schemas
├── RiskService.response.ts        # Response schemas
└── RiskService.types.ts           # Types and errors

src/server/tools/
├── RiskManagementToolRegistry.ts      # Tool registration
├── RiskManagementToolRegistry.spec.ts # Tests (10-15 tests)
└── index.ts                           # Updated exports
```

## 5. Request Schemas

### CalculatePositionSizeRequestSchema

```typescript
export const CalculatePositionSizeRequestSchema = z.object({
  accountBalance: z.number().positive().describe('Total account balance in EUR'),
  winRate: z.number().min(0).max(1).describe('Historical win rate (0.0 to 1.0)'),
  avgWin: z.number().positive().describe('Average winning trade amount'),
  avgLoss: z.number().positive().describe('Average losing trade amount'),
  kellyFraction: z.number().min(0.1).max(1.0).default(0.25).optional()
    .describe('Fraction of Kelly (0.25=quarter, 0.5=half, 1.0=full)'),
  maxPositionPct: z.number().min(0).max(1).default(0.10).optional()
    .describe('Maximum position size as fraction of account'),
  minCashReservePct: z.number().min(0).max(1).default(0.10).optional()
    .describe('Minimum cash reserve as fraction of account'),
});
```

### GetRiskMetricsRequestSchema

```typescript
export const GetRiskMetricsRequestSchema = z.object({
  prices: z.array(z.number().positive()).min(2)
    .describe('Historical prices (chronological, oldest first)'),
  riskFreeRate: z.number().min(0).max(1).default(0.02).optional()
    .describe('Annual risk-free rate for Sharpe ratio'),
  confidenceLevel: z.number().min(0.5).max(0.99).default(0.95).optional()
    .describe('Confidence level for VaR (0.95 or 0.99)'),
  timeframe: z.enum(['daily', 'weekly', 'monthly']).default('daily').optional()
    .describe('Timeframe of price data for annualization'),
});
```

## 6. Response Schemas

### CalculatePositionSizeResponseSchema

```typescript
export const CalculatePositionSizeResponseSchema = z.object({
  kellyPercentage: z.number().describe('Raw Kelly percentage'),
  adjustedPercentage: z.number().describe('After fraction and cap'),
  positionSizeAmount: z.number().describe('Recommended size in EUR'),
  maxPositionSize: z.number().describe('Maximum allowed size'),
  availableCapital: z.number().describe('After cash reserve'),
  winLossRatio: z.number().describe('Win/Loss ratio used'),
  warnings: z.array(z.string()).describe('Warning messages'),
  timestamp: z.string(),
});
```

### GetRiskMetricsResponseSchema

```typescript
export const GetRiskMetricsResponseSchema = z.object({
  volatility: z.object({
    daily: z.number(),
    annualized: z.number(),
  }),
  valueAtRisk: z.object({
    parametric: z.number(),
    historical: z.number(),
    confidenceLevel: z.number(),
  }),
  maxDrawdown: z.object({
    value: z.number(),
    percent: z.number(),
    peakIndex: z.number().int(),
    troughIndex: z.number().int(),
  }),
  sharpeRatio: z.number().nullable(),
  returns: z.object({
    total: z.number(),
    mean: z.number(),
    annualized: z.number(),
  }),
  dataPoints: z.number().int(),
  timeframe: z.enum(['daily', 'weekly', 'monthly']),
  timestamp: z.string(),
});
```

## 7. Types and Errors

```typescript
export class RiskServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RiskServiceError';
  }
}

export const TRADING_DAYS_PER_YEAR = 252;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

export const CONFIDENCE_Z_SCORES: Record<number, number> = {
  0.90: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};
```

## 8. Service Implementation

```typescript
export class RiskService {
  public calculatePositionSize(
    request: CalculatePositionSizeRequest,
  ): CalculatePositionSizeResponse {
    // 1. Calculate win/loss ratio
    // 2. Calculate raw Kelly percentage
    // 3. Apply fractional Kelly
    // 4. Calculate available capital (after reserve)
    // 5. Apply max position cap
    // 6. Generate warnings
    // 7. Return result
  }

  public getRiskMetrics(
    request: GetRiskMetricsRequest,
  ): GetRiskMetricsResponse {
    // 1. Calculate returns from prices
    // 2. Calculate volatility
    // 3. Calculate VaR (parametric and historical)
    // 4. Calculate max drawdown
    // 5. Calculate Sharpe ratio
    // 6. Calculate return statistics
    // 7. Return result
  }

  // Private calculation methods
  private calculateKellyPercentage(winRate: number, winLossRatio: number): number;
  private calculateReturns(prices: number[]): number[];
  private calculateVolatility(returns: number[], timeframe: string): VolatilityResult;
  private calculateVaR(returns: number[], confidence: number): VaRResult;
  private calculateMaxDrawdown(prices: number[]): MaxDrawdownResult;
  private calculateSharpeRatio(returns: number[], volatility: number, riskFreeRate: number, timeframe: string): number | null;
}
```

## 9. TDD Implementation Order

### Phase 1: Types and Schemas (RED)
1. Create RiskService.types.ts
2. Create RiskService.request.ts
3. Create RiskService.response.ts

### Phase 2: Kelly Criterion (RED-GREEN-REFACTOR)
1. Test: Basic Kelly calculation → Implement calculateKellyPercentage
2. Test: Fractional Kelly → Add fraction logic
3. Test: Position caps → Add capping
4. Test: Cash reserve → Add reserve calculation
5. Test: Warnings → Add warning generation
6. Test: Validation → Add error handling

### Phase 3: Returns Calculation (RED-GREEN-REFACTOR)
1. Test: Simple returns → Implement calculateReturns
2. Test: Edge cases → Handle single price, constant prices

### Phase 4: Volatility (RED-GREEN-REFACTOR)
1. Test: Daily volatility → Implement std dev
2. Test: Annualization → Add timeframe logic
3. Test: Zero volatility → Handle edge case

### Phase 5: VaR (RED-GREEN-REFACTOR)
1. Test: Parametric VaR → Implement formula
2. Test: Historical VaR → Implement percentile
3. Test: Different confidences → Support 95% and 99%

### Phase 6: Max Drawdown (RED-GREEN-REFACTOR)
1. Test: Simple drawdown → Implement tracking
2. Test: Peak/trough indices → Add index tracking
3. Test: No drawdown → Handle edge case

### Phase 7: Sharpe Ratio (RED-GREEN-REFACTOR)
1. Test: Basic Sharpe → Implement formula
2. Test: Annualization → Add timeframe support
3. Test: Zero volatility → Return null

### Phase 8: Integration (RED-GREEN-REFACTOR)
1. Test: Full calculatePositionSize workflow
2. Test: Full getRiskMetrics workflow

### Phase 9: Tool Registry (RED-GREEN-REFACTOR)
1. Test: Tool registration
2. Test: Handler execution
3. Implement RiskManagementToolRegistry

### Phase 10: Server Integration
1. Update TradeRepublicMcpServer.ts
2. Update exports
3. Run full test suite

## 10. Dependencies

**No new npm packages required.**

Uses existing:
- `zod` - Schema validation
- Native JavaScript Math functions

## 11. Success Criteria

- [ ] 2 tools registered: `calculate_position_size`, `get_risk_metrics`
- [ ] 100% test coverage with 70-95 tests
- [ ] Kelly Criterion with fractional support
- [ ] Volatility with proper annualization
- [ ] VaR (parametric and historical)
- [ ] Maximum drawdown with peak/trough tracking
- [ ] Sharpe ratio (null if zero volatility)
- [ ] No external dependencies or API calls
- [ ] Clear warning messages for risky parameters
- [ ] Follows existing service patterns
- [ ] Uses `public` visibility modifiers
- [ ] All schemas validated with Zod
