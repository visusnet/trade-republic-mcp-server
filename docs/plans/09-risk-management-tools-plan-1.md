# Task 09: Risk Management Tools - Implementation Plan (Agent 1)

## 1. Overview

This plan implements **RiskService** with two MCP tools: `calculate_position_size` and `get_risk_metrics`. The service provides calculation-only risk management capabilities using the Kelly Criterion for position sizing and comprehensive risk metrics (volatility, VaR, max drawdown, Sharpe ratio).

**Key Principle**: This is a **pure calculation service** - no external APIs, no data fetching. It processes price/return data provided by the caller to calculate risk metrics.

## 2. Research Summary

### 2.1 Kelly Criterion for Position Sizing

The Kelly Criterion determines optimal position size to maximize long-term growth:

**Formula**: `Kelly % = W - [(1-W) / R]`
- W = Win rate (probability of winning trade)
- R = Win/Loss ratio (average win / average loss)

**Practical Considerations**:
- **Full Kelly is aggressive**: Can lead to large drawdowns
- **Fractional Kelly (recommended)**: Professional traders use 1/4 to 1/2 Kelly
  - Half Kelly: ~75% of optimal growth, much lower drawdown
  - Quarter Kelly: More conservative, safer for real trading
- **Risk of ruin**: Overestimating win rate can be catastrophic
- **Max position limits**: Apply hard caps (e.g., 10% of portfolio)

### 2.2 Value at Risk (VaR)

VaR estimates maximum expected loss over a time period at a given confidence level.

**Two Primary Methods**:

1. **Parametric (Variance-Covariance)**:
   - Assumes normal distribution of returns
   - VaR = μ - (z × σ)
   - Fast, simple, but assumes normality

2. **Historical Simulation**:
   - Uses actual historical returns
   - Sorts returns, takes percentile cutoff
   - No distribution assumptions

### 2.3 Risk Metrics

**Volatility (Standard Deviation)**:
- Annualized: σ_annual = σ_daily × √252 (trading days per year)

**Maximum Drawdown (MDD)**:
- Largest peak-to-trough decline
- MDD = (Trough Value - Peak Value) / Peak Value

**Sharpe Ratio**:
- Risk-adjusted return metric
- Formula: `Sharpe = (Return - Risk-Free Rate) / Volatility`
- >1.0 = good, >2.0 = very good, >3.0 = excellent

## 3. Architecture Design

### 3.1 Service Architecture

```
TradeRepublicMcpServer
    └── RiskManagementToolRegistry
            └── RiskService (pure calculation)
                    - calculatePositionSize()
                    - getRiskMetrics()
```

**Design Decisions**:

1. **Pure calculation service**: No dependencies on other services. Caller provides price/return data.
2. **Stateless**: No caching, no state. Each call is independent.
3. **All calculations in-service**: No separate utility classes for formulas (YAGNI)

### 3.2 File Structure

```
src/server/services/
├── RiskService.ts                 # Main service implementation
├── RiskService.spec.ts            # Unit tests (~60-80 tests)
├── RiskService.request.ts         # Request Zod schemas
├── RiskService.response.ts        # Response Zod schemas
└── RiskService.types.ts           # Internal types and errors

src/server/tools/
├── RiskManagementToolRegistry.ts      # Tool registration
├── RiskManagementToolRegistry.spec.ts # Tool registry tests (~10-15 tests)
└── index.ts                           # Updated exports
```

## 4. Request/Response Schemas

### 4.1 CalculatePositionSizeRequest

```typescript
export const CalculatePositionSizeRequestSchema = z.object({
  accountBalance: z.number().positive().describe('Total account balance in EUR'),
  winRate: z.number().min(0).max(1).describe('Historical win rate (0.0 to 1.0)'),
  avgWin: z.number().positive().describe('Average winning trade amount in EUR'),
  avgLoss: z.number().positive().describe('Average losing trade amount in EUR'),
  kellyFraction: z.number().min(0.1).max(1.0).default(0.25).optional(),
  maxPositionPct: z.number().min(0).max(1).default(0.10).optional(),
  minCashReservePct: z.number().min(0).max(1).default(0.10).optional(),
});
```

### 4.2 GetRiskMetricsRequest

```typescript
export const GetRiskMetricsRequestSchema = z.object({
  prices: z.array(z.number().positive()).min(2).describe('Array of historical prices'),
  initialInvestment: z.number().positive().optional(),
  riskFreeRate: z.number().min(0).max(1).default(0.02).optional(),
  confidenceLevel: z.number().min(0.5).max(0.99).default(0.95).optional(),
  timeframe: z.enum(['daily', 'weekly', 'monthly']).default('daily').optional(),
});
```

## 5. TDD Test Cases

### Position Sizing Tests (15-20 tests)
- Basic Kelly calculation with different win rates and ratios
- Fractional Kelly (quarter, half, full)
- Position caps and cash reserve
- Edge cases: zero win rate, 100% win rate
- Warnings for negative Kelly, high Kelly, low win rate
- Validation errors

### Risk Metrics Tests (30-40 tests)
- Volatility calculation (daily and annualized)
- VaR parametric and historical methods
- Maximum drawdown tracking
- Sharpe ratio calculation
- Return statistics
- Edge cases: insufficient data, zero volatility

### Tool Registry Tests (10-15 tests)
- Tool registration
- Handler execution
- Error handling

## 6. Success Criteria

- [ ] Both tools registered and working
- [ ] 100% test coverage with 60-80+ tests
- [ ] Kelly Criterion with fractional Kelly support
- [ ] Volatility with proper annualization
- [ ] VaR using parametric and historical methods
- [ ] Maximum drawdown with peak/trough tracking
- [ ] Sharpe ratio with proper annualization
- [ ] No external dependencies or API calls
- [ ] Follows existing service patterns
