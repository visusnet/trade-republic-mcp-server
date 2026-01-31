# Trade Republic Trading Bot - Design Document

**Date:** 2026-01-31

## Overview

An autonomous trading bot for Trade Republic that uses Claude as the decision engine and a custom MCP server as the data/execution layer. The architecture mirrors the coinbase-mcp-server project.

## Goals

- Maximize trading profits
- Support all Trade Republic asset types (stocks, ETFs, crypto, derivatives)
- Use multiple trading strategies adaptively
- Minimize Claude API costs where possible without sacrificing decision quality
- Allow user configuration of autonomy levels

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Skill                            │
│  /trade-republic [options]                                  │
│  - Parses user instructions (autonomy level, thresholds)    │
│  - Runs main trading loop                                   │
│  - Makes all trading decisions                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol
┌─────────────────────▼───────────────────────────────────────┐
│                   MCP Server                                │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                     │
│  - Market data (prices, portfolio, orders)                  │
│  - Technical indicators (RSI, MACD, Bollinger, etc.)        │
│  - External data (news, fundamentals, sentiment)            │
│  - Trade execution (buy, sell, order management)            │
│  - Risk calculations (Kelly, position sizing)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Data Sources                              │
├──────────────┬──────────────┬───────────────────────────────┤
│ Trade Rep.   │ Free APIs    │ Web Scraping                  │
│ (pytr-style) │ Yahoo/Alpha  │ News, Sentiment               │
└──────────────┴──────────────┴───────────────────────────────┘
```

### Key Principles

- **Claude is the decision engine** - All trading logic lives in the skill
- **MCP server is the data/execution layer** - Provides tools, no trading logic
- **User configurable** - Autonomy levels, risk parameters, asset focus via skill parameters
- **Adaptive behavior** - Polling frequency, risk management, strategy selection all dynamic

## MCP Server Tools

### Portfolio
| Tool | Description |
|------|-------------|
| `get_portfolio` | Current holdings and positions |
| `get_cash_balance` | Available cash balance |

### Market Data
| Tool | Description |
|------|-------------|
| `get_price` | Current price for an asset |
| `get_price_history` | OHLCV candles for a timeframe |
| `get_order_book` | Bid/ask depth |
| `search_assets` | Find tradeable assets by query and type |
| `get_asset_info` | Asset type, trading hours, min order size, fees |
| `get_market_status` | Is market open? When does it open/close? |
| `wait_for_market` | Sleep until market opens |

### Technical Analysis
| Tool | Description |
|------|-------------|
| `get_indicators` | Pre-computed summary (RSI, MACD, Bollinger, etc.) |
| `get_detailed_analysis` | Full technical breakdown for a symbol |

### External Data
| Tool | Description |
|------|-------------|
| `get_news` | Recent news headlines (optional symbol filter) |
| `get_sentiment` | Scraped sentiment signals |
| `get_fundamentals` | Basic financial data |

### Risk Management
| Tool | Description |
|------|-------------|
| `calculate_position_size` | Kelly or Claude-adjusted sizing |
| `get_risk_metrics` | Current portfolio risk exposure, drawdown |

### Execution
| Tool | Description |
|------|-------------|
| `place_order` | Execute trade (market, limit, etc.) |
| `get_orders` | Open/recent orders |
| `modify_order` | Adjust existing order |
| `cancel_order` | Cancel pending order |

### MCP Prompt

The server registers an `assist` prompt that provides Claude with:
- Summary of all available tools (categorized)
- Best practices for using the MCP server

## Trade Republic API Integration

### Approach

Reverse-engineered API (similar to pytr project). Trade Republic does not offer a public API.

### Authentication

- Phone number + PIN login flow
- 2FA handling (SMS or app confirmation)
- Session token management and refresh

### Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| No official documentation | Study pytr and similar projects |
| API may change without notice | Robust error handling and retry logic |
| Rate limiting unknown | Conservative defaults, adaptive backoff |
| 2FA complicates autonomy | Cache session tokens, research long-lived sessions |

### Unknown: 2FA Handling

To be researched during implementation. Need to determine if long-lived sessions are possible or if periodic manual 2FA approval is required.

## Data Sources

### Trade Republic (Primary)
- Portfolio, positions, cash balance
- Real-time prices
- Order book data
- Order execution

### Free External APIs
- **Yahoo Finance** - Price history, basic fundamentals
- **Alpha Vantage** (free tier) - Technical indicators, forex rates
- **Financial Modeling Prep** (free tier) - Company fundamentals, news

### Web Scraping
- **News sites** - Reuters, Bloomberg headlines, financial news
- **Reddit** - r/wallstreetbets, r/stocks sentiment
- **Twitter/X** - Only if accessible without account (to be verified)

### Caching Strategy
| Data Type | TTL |
|-----------|-----|
| Price data | Seconds to minutes |
| Fundamentals | Hours to days |
| News/sentiment | Minutes |

## Trading Strategies

Claude selects and combines strategies based on market conditions:

1. **Technical Momentum** - Catching trends using indicators (RSI, MACD, moving averages)
2. **Mean Reversion** - Buying oversold assets, selling overbought
3. **Event-Driven** - Trading on news, earnings, macro events
4. **Multi-Factor** - Combining technicals, fundamentals, sentiment
5. **Arbitrage** - Exploiting price differences across assets or timeframes

## Risk Management

### Dynamic Risk (Claude-driven)

Claude assesses each trade considering:
- Market volatility
- Confidence in the signal
- Current portfolio exposure
- Correlation with existing positions
- News/event risk

### Kelly Criterion Fallback

When Claude's confidence is low:
```
Kelly % = (win_rate × avg_win - loss_rate × avg_loss) / avg_win
```
Requires tracking historical trade performance.

### Hard Limits (Non-negotiable)

| Limit | Default |
|-------|---------|
| Maximum position size | 10% of portfolio |
| Maximum daily loss | 5% of portfolio |
| Minimum cash reserve | 10% |

### Portfolio-Level Risk
- Sector/asset concentration limits
- Correlation monitoring
- Drawdown tracking and response

## Execution

### Smart Order Routing

Claude decides order type based on context:
- **Market orders** - Urgent signals, high liquidity
- **Limit orders** - Better entries when time permits
- **Staged execution** - Large orders broken into chunks

## Claude Skill Interface

### Location
```
.claude/skills/trade-republic-trading/
├── SKILL.md              # Main skill definition
├── strategies.md         # Trading strategies reference
├── indicators.md         # Indicator usage guide
└── state-schema.md       # State management
```

### Invocation
```
/trade-republic [options]
```

### Options (Natural Language)

| Option | Examples |
|--------|----------|
| Autonomy | "approve trades above 50 EUR", "fully autonomous", "notify only" |
| Asset focus | "only crypto", "focus on tech stocks", "all assets" |
| Risk level | "conservative", "aggressive", "max 2% per trade" |
| Duration | "run for 1 hour", "until market close", "continuous" |

### Example Invocations
```
/trade-republic
/trade-republic conservative mode, notify me of all trades
/trade-republic focus on ETFs, approve anything above 100 EUR
/trade-republic aggressive crypto trading, fully autonomous
```

### Main Loop

```
1. Parse user instructions → config
2. Loop:
   a. Check market status (wait if closed)
   b. Scan portfolio and watchlist
   c. Gather external data (news, sentiment)
   d. Analyze opportunities
   e. Make trading decisions
   f. Execute (or request approval based on config)
   g. Adaptive sleep based on volatility
```

## Project Structure

```
trade-republic-bot/
├── .claude/
│   ├── skills/
│   │   └── trade-republic-trading/
│   │       ├── SKILL.md
│   │       ├── strategies.md
│   │       ├── indicators.md
│   │       └── state-schema.md
│   ├── commands/
│   └── rules/
├── src/
│   ├── index.ts
│   ├── logger.ts
│   ├── server/
│   │   ├── TradeRepublicMcpServer.ts
│   │   ├── TradeRepublicMcpServer.spec.ts
│   │   ├── tools/
│   │   │   ├── registry.ts
│   │   │   ├── portfolio/
│   │   │   │   ├── getPortfolio.request.ts
│   │   │   │   ├── getPortfolio.response.ts
│   │   │   │   ├── getPortfolio.ts
│   │   │   │   └── getPortfolio.spec.ts
│   │   │   ├── market/
│   │   │   ├── analysis/
│   │   │   ├── external/
│   │   │   ├── risk/
│   │   │   └── execution/
│   │   └── services/
│   │       ├── TradeRepublicApiService.ts
│   │       ├── TechnicalAnalysisService.ts
│   │       ├── NewsService.ts
│   │       ├── SentimentService.ts
│   │       └── RiskService.ts
│   └── test/
├── docs/
│   ├── adr/
│   ├── plans/
│   └── retrospective-notes.md
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.js
├── eslint.config.js
├── rollup.config.js
├── knip.json
├── .prettierrc.json
├── .gitignore
└── .nvmrc
```

### Patterns from coinbase-mcp-server

| Pattern | Description |
|---------|-------------|
| `TradeRepublicMcpServer` | Main server class |
| `ToolRegistry` | Tool organization and registration |
| `*.request.ts` | Zod schemas for tool inputs |
| `*.response.ts` | Zod schemas for tool outputs |
| `*Service` | Business logic classes |
| `*.spec.ts` | Jest test files alongside source |

## Open Questions / Unknowns

1. **Trade Republic 2FA** - How to handle for autonomous operation? Research pytr approach.
2. **Twitter/X access** - Verify if accessible without account. Drop if not.
3. **TR API rate limits** - Unknown, need conservative defaults and monitoring.
4. **TR WebSocket structure** - Research for real-time price updates.

## Next Steps

1. Initialize project with package.json, tsconfig, eslint, prettier, jest, rollup, knip
2. Research Trade Republic API (pytr and similar projects)
3. Implement MCP server skeleton with tool registry
4. Implement Trade Republic API service
5. Add technical analysis tools
6. Add external data sources
7. Implement risk management tools
8. Create Claude skill
9. Integration testing
10. Documentation
