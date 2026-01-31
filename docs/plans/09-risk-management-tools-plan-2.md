# Task 09: Risk Management Tools - Implementation Plan (Agent 2)

## Overview

This plan details the implementation of **RiskService** with two MCP tools:
- `calculate_position_size` - Kelly Criterion-based position sizing
- `get_risk_metrics` - Portfolio and instrument risk metrics (volatility, VaR, max drawdown, Sharpe ratio)

This is a **calculation-only service** requiring no external APIs or authentication.

## Research Findings

### Kelly Criterion Formula

**f* = (bp - q) / b** which translates to:
**Kelly % = W - [(1 - W) / R]**

Where:
- W = win rate (0-1)
- R = average win / average loss ratio

**Practical Considerations:**
- Full Kelly is aggressive
- Half Kelly (Kelly% / 2) or Quarter Kelly (Kelly% / 4) recommended
- Should be capped at reasonable maximums (e.g., 25% of portfolio)

### Risk Metrics Formulas

#### 1. Volatility
- Annualized volatility = σ × √252 (252 trading days/year)
- σ = standard deviation of daily returns

#### 2. Value at Risk (VaR)
Using Variance-Covariance method:
- VaR(α) = μ - (z_α × σ)
- For 95% confidence: z_α = 1.65
- For 99% confidence: z_α = 2.33

#### 3. Maximum Drawdown
- Max Drawdown = (Trough - Peak) / Peak
- Track running maximum and current drawdown

#### 4. Sharpe Ratio
**Sharpe Ratio = (R_p - R_f) / σ_p**

## File Structure

```
src/server/services/
├── RiskService.ts                  # Main service implementation
├── RiskService.request.ts          # Zod request schemas
├── RiskService.response.ts         # Zod response schemas
├── RiskService.types.ts            # Custom types and errors
└── RiskService.spec.ts             # Jest tests (TDD)

src/server/tools/
├── RiskManagementToolRegistry.ts       # MCP tool registration
└── RiskManagementToolRegistry.spec.ts  # Jest tests
```

## Dependencies

**No new npm packages required.** All calculations use native TypeScript Math functions.

## Request Schemas

### CalculatePositionSizeRequest

```typescript
export const CalculatePositionSizeRequestSchema = z.object({
  accountBalance: z.number().positive(),
  winRate: z.number().min(0).max(1),
  avgWin: z.number().positive(),
  avgLoss: z.number().positive(),
  strategy: z.enum(['full', 'half', 'quarter']).default('half').optional(),
  maxPositionPercent: z.number().min(0).max(100).default(25).optional(),
  currentPrice: z.number().positive(),
});
```

### GetRiskMetricsRequest

Agent 2 proposed fetching from MarketDataService, but this conflicts with the pure calculation approach. I recommend using the Agent 1 approach with prices array input.

## Response Schemas

### CalculatePositionSizeResponse

```typescript
export const CalculatePositionSizeResponseSchema = z.object({
  kellyPercentage: z.number(),
  adjustedPercentage: z.number(),
  positionSizeAmount: z.number(),
  positionSizeShares: z.number().int(),
  strategy: z.string(),
  winLossRatio: z.number(),
  recommendation: z.string(),
  timestamp: z.string(),
});
```

### GetRiskMetricsResponse

```typescript
export const GetRiskMetricsResponseSchema = z.object({
  volatility: z.object({
    daily: z.number(),
    annualized: z.number(),
  }),
  valueAtRisk: z.object({
    confidence: z.string(),
    daily: z.number(),
    percent: z.number(),
  }),
  maxDrawdown: z.object({
    value: z.number(),
    percent: z.number(),
    peakDate: z.string().nullable(),
    troughDate: z.string().nullable(),
  }),
  sharpeRatio: z.number(),
  returns: z.object({
    total: z.number(),
    annualized: z.number(),
  }),
  dataPoints: z.number(),
  timestamp: z.string(),
});
```

## TDD Test Cases

### calculatePositionSize Tests:
1. Basic Kelly calculation with valid inputs
2. Quarter and half Kelly strategy multipliers
3. maxPositionPercent cap enforcement
4. Negative Kelly (unfavorable odds) handling
5. Share calculation from position size
6. Validation errors for invalid inputs

### getRiskMetrics Tests:
1. Volatility calculation (daily and annualized)
2. VaR calculation (95% and 99% confidence)
3. Max drawdown calculation with peak/trough tracking
4. Sharpe ratio calculation
5. Insufficient data error handling
6. Edge cases (zero volatility, no drawdown)

## Implementation Order (TDD)

### Phase 1: Position Size Calculator
1. Test basic Kelly calculation → Implement formula
2. Test strategy multipliers → Add strategy logic
3. Test max cap → Add capping logic
4. Test negative Kelly → Add validation and warnings
5. Test share calculation → Add share math

### Phase 2: Risk Metrics
1. Test volatility → Implement calculateVolatility
2. Test VaR → Implement calculateVaR
3. Test max drawdown → Implement calculateMaxDrawdown
4. Test Sharpe ratio → Implement calculateSharpeRatio
5. Test integration → Wire everything together

### Phase 3: Tool Registry
1. Test tool registration → Implement RiskManagementToolRegistry
2. Test schema validation → Add request/response schemas
3. Test tool invocation → Bind service methods

## Success Criteria

- [ ] Both tools registered and working
- [ ] 100% test coverage
- [ ] Kelly Criterion with strategy options (full/half/quarter)
- [ ] Volatility calculation with annualization
- [ ] VaR with 95% and 99% confidence levels
- [ ] Maximum drawdown with peak/trough tracking
- [ ] Sharpe ratio calculation
- [ ] No external dependencies
- [ ] Follows existing service patterns
- [ ] All public methods have `public` modifier
