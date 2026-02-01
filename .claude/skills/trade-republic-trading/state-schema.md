# Trading State Schema

Single Source of Truth for `.claude/trading-state.json` structure.

## File Location

`.claude/trading-state.json`

## Complete Structure

```json
{
  "session": {
    "id": "2026-01-12T13:15:00Z",
    "startTime": "2026-01-12T13:15:00Z",
    "lastUpdated": "2026-01-13T14:32:00Z",
    "budget": {
      "initial": 100.00,
      "remaining": 85.50,
      "currency": "EUR"
    },
    "stats": {
      "tradesOpened": 3,
      "tradesClosed": 2,
      "wins": 1,
      "losses": 1,
      "totalFeesPaid": 2.50,
      "realizedPnL": 5.25,
      "realizedPnLPercent": 5.25
    },
    "config": {
      "strategy": "aggressive",
      "interval": "15m",
      "dryRun": false,
      "allowedAssetTypes": ["stock", "etf", "crypto"]
    },
    "compound": {
      "enabled": true,
      "rate": 0.50,
      "maxBudget": 200.00,
      "totalCompounded": 2.50
    },
    "rebalancing": {
      "enabled": true,
      "stagnationHours": 12,
      "maxPerDay": 3,
      "rebalancesToday": 0
    }
  },
  "openPositions": [],
  "tradeHistory": []
}
```

## Session Object Fields

| Field | Type | Purpose |
|-------|------|---------|
| `session.id` | string | Unique session identifier (= startTime) |
| `session.startTime` | string | ISO 8601 timestamp |
| `session.lastUpdated` | string | ISO 8601, last state change |
| `session.budget.initial` | number | Starting budget in EUR |
| `session.budget.remaining` | number | Available budget in EUR |
| `session.budget.currency` | string | Always "EUR" |
| `session.stats.tradesOpened` | number | Total entries |
| `session.stats.tradesClosed` | number | Total exits |
| `session.stats.wins` | number | Profitable closes |
| `session.stats.losses` | number | Losing closes |
| `session.stats.totalFeesPaid` | number | Cumulative fees (EUR) |
| `session.stats.realizedPnL` | number | Realized P/L (EUR) |
| `session.stats.realizedPnLPercent` | number | Realized P/L (%) |
| `session.config.strategy` | string | "aggressive" / "conservative" / "scalping" |
| `session.config.interval` | string | "5m" / "15m" / "1h" |
| `session.config.dryRun` | boolean | Dry-run mode active |
| `session.config.allowedAssetTypes` | array | Asset types to trade |
| `session.compound.enabled` | boolean | Is compound mode active |
| `session.compound.rate` | number | Reinvestment rate (0.0-1.0) |
| `session.compound.maxBudget` | number | Budget cap |
| `session.compound.totalCompounded` | number | Total amount reinvested (EUR) |
| `session.rebalancing.enabled` | boolean | Is rebalancing active |
| `session.rebalancing.stagnationHours` | number | Hours to consider position stagnant |
| `session.rebalancing.maxPerDay` | number | Max daily rebalances |
| `session.rebalancing.rebalancesToday` | number | Rebalances today |

## Position Schema

```json
{
  "id": "pos_20260112_131758_DE000A0TGJ55",
  "isin": "DE000A0TGJ55",
  "name": "iShares Core DAX UCITS ETF",
  "assetType": "etf",
  "side": "long",
  "size": 2,
  "entry": {
    "price": 142.50,
    "time": "2026-01-12T13:17:58Z",
    "orderType": "market",
    "fee": 1.00
  },
  "analysis": {
    "signalStrength": 65,
    "technicalScore": 58,
    "sentiment": "bullish",
    "reason": "MACD Golden Cross + RSI oversold (28)",
    "confidence": "medium"
  },
  "riskManagement": {
    "entryATR": 2.85,
    "dynamicSL": 138.22,
    "dynamicTP": 149.63,
    "trailingStop": {
      "active": false,
      "currentStopPrice": null,
      "highestPrice": 142.50
    }
  },
  "performance": {
    "currentPrice": null,
    "unrealizedPnL": null,
    "unrealizedPnLPercent": null,
    "peakPnLPercent": 0,
    "holdingTimeHours": null
  }
}
```

## Position Object Fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique ID: `pos_{date}_{time}_{isin}` |
| `isin` | string | Asset ISIN (e.g., DE000A0TGJ55) |
| `name` | string | Human-readable asset name |
| `assetType` | enum | "stock" / "etf" / "crypto" / "derivative" |
| `side` | enum | "long" (future: "short") |
| `size` | number | Position size (units) |
| `entry.price` | number | Entry price (EUR) |
| `entry.time` | string | ISO 8601 timestamp |
| `entry.orderType` | enum | "market" / "limit" / "stop-market" |
| `entry.fee` | number | Entry fee (EUR) |
| `analysis.signalStrength` | number | Final score (0-100) |
| `analysis.technicalScore` | number | Technical score (0-100) |
| `analysis.sentiment` | enum | "bullish" / "neutral" / "bearish" |
| `analysis.reason` | string | Top indicators |
| `analysis.confidence` | enum | "high" / "medium" / "low" |
| `riskManagement.entryATR` | number | ATR at entry |
| `riskManagement.dynamicSL` | number | ATR-based stop-loss price (EUR) |
| `riskManagement.dynamicTP` | number | ATR-based take-profit price (EUR) |
| `riskManagement.trailingStop.active` | boolean | Is trailing active? |
| `riskManagement.trailingStop.currentStopPrice` | number | Current trail price |
| `riskManagement.trailingStop.highestPrice` | number | Peak price |
| `performance.currentPrice` | number | Latest price |
| `performance.unrealizedPnL` | number | Current P/L (EUR) |
| `performance.unrealizedPnLPercent` | number | Current P/L (%) |
| `performance.peakPnLPercent` | number | Best P/L achieved |
| `performance.holdingTimeHours` | number | Hours since entry |

## Trade History Entry Schema

```json
{
  "id": "trade_20260112_120000_DE000A0TGJ55",
  "isin": "DE000A0TGJ55",
  "name": "iShares Core DAX UCITS ETF",
  "assetType": "etf",
  "side": "long",
  "size": 2,
  "entry": {
    "price": 140.00,
    "time": "2026-01-12T12:00:00Z",
    "orderType": "limit",
    "fee": 1.00
  },
  "exit": {
    "price": 145.00,
    "time": "2026-01-12T13:15:00Z",
    "orderType": "limit",
    "fee": 1.00,
    "trigger": "takeProfit",
    "reason": "Dynamic TP hit at +3.6%"
  },
  "result": {
    "grossPnL": 10.00,
    "netPnL": 8.00,
    "netPnLPercent": 2.86,
    "totalFees": 2.00,
    "holdingTimeHours": 1.25
  }
}
```

## Trade History Fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique ID: `trade_{date}_{time}_{isin}` |
| `isin` | string | Asset ISIN |
| `name` | string | Human-readable asset name |
| `assetType` | enum | "stock" / "etf" / "crypto" / "derivative" |
| `side` | enum | "long" |
| `size` | number | Position size |
| `entry.*` | object | Same as openPositions |
| `exit.price` | number | Exit price (EUR) |
| `exit.time` | string | ISO 8601 timestamp |
| `exit.orderType` | enum | "market" / "limit" / "stop-market" |
| `exit.fee` | number | Exit fee (EUR) |
| `exit.trigger` | enum | "stopLoss" / "takeProfit" / "trailingStop" / "rebalance" / "manual" |
| `exit.reason` | string | Human-readable reason |
| `result.grossPnL` | number | P/L before fees (EUR) |
| `result.netPnL` | number | P/L after fees (EUR) |
| `result.netPnLPercent` | number | Net P/L (%) |
| `result.totalFees` | number | Entry + exit fees |
| `result.holdingTimeHours` | number | Total hold duration |

## Enums

- `assetType`: "stock" | "etf" | "crypto" | "derivative"
- `entry.orderType`: "market" | "limit" | "stop-market"
- `analysis.confidence`: "high" | "medium" | "low"
- `analysis.sentiment`: "bullish" | "neutral" | "bearish"
- `exit.trigger`: "stopLoss" | "takeProfit" | "trailingStop" | "rebalance" | "manual"

## State Operations

### Initialize Session

```
session.id = current timestamp
session.startTime = current timestamp
session.lastUpdated = current timestamp
session.budget.initial = budget from arguments (EUR)
session.budget.remaining = budget from arguments
session.budget.currency = "EUR"
session.stats.* = all 0
session.config.strategy = parsed or "aggressive"
session.config.interval = parsed or "15m"
session.config.dryRun = true if "dry-run" in arguments
session.config.allowedAssetTypes = parsed or ["stock", "etf", "crypto"]
session.compound.enabled = true (unless "no-compound")
session.compound.rate = 0.50
session.compound.maxBudget = 2 * initial budget
session.compound.totalCompounded = 0
session.rebalancing.enabled = true (unless "no-rebalance")
session.rebalancing.stagnationHours = 12
session.rebalancing.maxPerDay = 3
session.rebalancing.rebalancesToday = 0
openPositions = []
tradeHistory = [] (or keep existing)
```

### Open Position

```
id = "pos_{YYYYMMDD}_{HHMMSS}_{ISIN}"
isin = asset ISIN
name = asset name from get_asset_info
assetType = "stock" / "etf" / "crypto" / "derivative"
side = "long"
size = calculated position size

entry.price = execution price
entry.time = current timestamp
entry.orderType = "market" or "limit" or "stop-market"
entry.fee = fee from order response

analysis.signalStrength = final score (0-100)
analysis.technicalScore = technical score
analysis.sentiment = "bullish" / "neutral" / "bearish"
analysis.reason = "MACD Golden Cross + RSI < 30"
analysis.confidence = "high" (>70) / "medium" (40-70) / "low" (<40)

riskManagement.entryATR = ATR(14) at entry
riskManagement.dynamicSL = calculated SL price (ATR-based)
riskManagement.dynamicTP = calculated TP price (ATR-based)
riskManagement.trailingStop.active = false
riskManagement.trailingStop.currentStopPrice = null
riskManagement.trailingStop.highestPrice = entry price

performance.* = null (updated each cycle)

session.stats.tradesOpened += 1
session.budget.remaining -= (size * price + fee)
session.lastUpdated = current timestamp
```

### Update Position (Each Cycle)

```
performance.currentPrice = current price from API
performance.unrealizedPnL = (current - entry) * size
performance.unrealizedPnLPercent = (current - entry) / entry * 100
performance.holdingTimeHours = hours since entry.time

IF unrealizedPnLPercent > peakPnLPercent:
  performance.peakPnLPercent = unrealizedPnLPercent

IF currentPrice > trailingStop.highestPrice:
  trailingStop.highestPrice = currentPrice

IF unrealizedPnLPercent >= 3.0:
  trailingStop.active = true
  // ATR-based trailing stop (consistent formula)
  trailDistance = entryATR / highestPrice
  trailingStop.currentStopPrice = highestPrice * (1 - trailDistance)

session.lastUpdated = current timestamp
```

### Close Position

```
historyEntry = {
  id: position.id.replace("pos_", "trade_"),
  isin, name, assetType, side, size, entry, analysis: from position,
  exit: {
    price: execution price,
    time: current timestamp,
    orderType: "market" or "limit",
    fee: fee from response,
    trigger: "stopLoss" | "takeProfit" | "trailingStop" | "rebalance" | "manual",
    reason: "Dynamic TP hit at +X%"
  },
  result: {
    grossPnL: (exit.price - entry.price) * size,
    netPnL: grossPnL - entry.fee - exit.fee,
    netPnLPercent: netPnL / (entry.price * size) * 100,
    totalFees: entry.fee + exit.fee,
    holdingTimeHours: performance.holdingTimeHours
  }
}

IF result.netPnL > 0: session.stats.wins += 1
ELSE: session.stats.losses += 1

session.stats.tradesClosed += 1
session.stats.totalFeesPaid += result.totalFees
session.stats.realizedPnL += result.netPnL
session.stats.realizedPnLPercent = realizedPnL / budget.initial * 100
session.budget.remaining += (exit.price * size - exit.fee)

// Apply compound if enabled
IF result.netPnL > 0 AND session.compound.enabled:
  compoundAmount = result.netPnL * session.compound.rate
  IF session.budget.remaining + compoundAmount <= session.compound.maxBudget:
    session.budget.remaining += compoundAmount
    session.compound.totalCompounded += compoundAmount

tradeHistory.push(historyEntry)
openPositions.remove(position)
session.lastUpdated = current timestamp
```
