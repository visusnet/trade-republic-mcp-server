# Trade Republic Bot - Task List

## High-Level Tasks

### Task 01: Project Setup
Initialize the TypeScript project with all tooling (package.json, tsconfig, eslint, prettier, jest, rollup, knip, git configuration).

### Task 02: Research Trade Republic API
Study pytr and similar projects to understand the Trade Republic API structure, authentication flow, and available endpoints. Document findings in an ADR.

### Task 03: MCP Server Skeleton
Create the TradeRepublicMcpServer class with Express app, MCP server instance, tool registry pattern, and assist prompt. No actual tools yet.

### Task 04: Trade Republic API Service
Implement TradeRepublicApiService for authentication (phone/PIN, 2FA, session management) and basic API communication.

### Task 05: Portfolio Tools
Implement get_portfolio and get_cash_balance tools with request/response schemas and tests.

### Task 06: Market Data Tools
Implement get_price, get_price_history, get_order_book, search_assets, get_asset_info, get_market_status, and wait_for_market tools.

### Task 07: Technical Analysis Service & Tools
Implement TechnicalAnalysisService and get_indicators, get_detailed_analysis tools using technical indicator library.

### Task 08: External Data Services & Tools
Implement NewsService, SentimentService and get_news, get_sentiment, get_fundamentals tools with web scraping and free API integration.

### Task 09: Risk Management Tools
Implement RiskService and calculate_position_size, get_risk_metrics tools with Kelly Criterion calculation.

### Task 10: Execution Tools
Implement place_order, get_orders, modify_order, cancel_order tools for trade execution.

### Task 11: Claude Skill
Create the trade-republic-trading skill with SKILL.md, strategies.md, indicators.md, state-schema.md, and main trading loop.

### Task 12: Integration Testing
End-to-end testing of the complete system with mocked Trade Republic API.

### Task 13: Documentation
README, usage guide, and any remaining ADRs.

---

## Progress Tracking

| Task | Status | Plan | Implementation | Review |
|------|--------|------|----------------|--------|
| 01 | completed | done | done | done |
| 02 | completed | N/A | done | done |
| 03 | completed | done | done | done |
| 04 | completed | done | done | done |
| 05 | completed | done | done | done |
| 06 | completed | done | done | done |
| 07 | completed | done | done | done |
| 08 | completed | done | done | done |
| 09 | completed | done | done | done |
| 10 | pending | - | - | - |
| 11 | pending | - | - | - |
| 12 | pending | - | - | - |
| 13 | pending | - | - | - |
