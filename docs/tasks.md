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

### Task 12: Design Decision Validation
For every ADR and major implementation decision, start at least two sub agents to independently verify whether the software has been implemented according to the documented decisions. Document them in docs/discrepancies.md.

### Task 13: Trade Republic API Verification
Start a sub agent to verify that the implementation of the Trade Republic API will (very likely) work as intended based on available community projects (compare with at least three community projects, not just one or two - pick recently and popular libraries), documentation and research. Document any discrepancies found in docs/discrepancies.md.

### Task 14: Fixing discrepancies found in Task 12 and Task 13

#### Resolution Planning
1. For each discrepancy found, brainstorm possible ways to fix it and discuss them with me.
   <reasoning>This ensures that we consider multiple approaches and select the most effective solution.</reasoning>
2. Create a plan for fixing the discrepancy with enough detail so that another sub agent can implement it without further input from you and without deviating from the brainstormed solution from step 1.
   - The plan must include the template for "Resolution Implementation" below verbatim - word for word - exactly as stated below.
   - The plan must not deviate from the brainstormed solution from step 1.
   - The plan must be as concise as possible while still being complete (include all the details that we discussed).
   - The plan should be executable according to the "Resolution Implementation" template below.
   - Write the plan into docs/plans/discrepancies/{discrepancy-id}-{short-description}.md.

#### Resolution Implementation
For each discrepancy found (one after another), spawn a sub agent to fix it by following these steps strictly (they are SACRED):
1. Write at least one test that tests the correct (atomic) behavior for a given discrepancy.
   <reasoning>These tests will initially fail because the implementation is currently incorrect but they will succeed once the implementation is fixed.</reasoning>
   If the implementation is currently wrong, there should already be tests for the incorrect behavior. Keep these tests for now.
   <reasoning>Keeping the tests for the incorrect behavior ensures that we can verify that the incorrect behavior is indeed fixed once we modify the implementation. These tests should fail after the fix, confirming the correction.</reasoning>
2. Modify the implementation to make the new test pass.
   -> new test(s) for correct behavior pass
   -> existing test(s) for incorrect behavior fail
3. If the implementation was wrong, there will be tests that verified the incorrect behavior. You can either:
    - remove them if new tests sufficiently cover the correct behavior and fit the overall test suite
      <example>
      Let's assume an old test for the incorrect behavior was called "returns price for valid asset id" and the new test for the correct behavior is called "returns price for valid asset id (after fix)". If the new test sufficiently covers the correct behavior and fits well within the overall test suite, we can remove the old test and remove "(after fix)" from the new test name.
      </example>
      <example>
      Let's assume an old test for the incorrect behavior was called "throws error for multiple asset ids" because the implementation incorrectly allowed multiple asset ids. The new test for the correct behavior is called "throws error for multiple asset ids (after fix)". If the new test sufficiently covers the correct behavior and fits well within the overall test suite, we can remove the old test and remove "(after fix)" from the new test name.
      </example>
    - or modify them to verify the correct behavior instead
      <example>
      Let's assume an old test that tests features adjacent to the incorrect behavior was called "calculates position size" and it has an expectation that checks for an incorrect value due to the wrong implementation. The new test for the correct behavior is called "returns risk metrics" which only focuses on the correct behavior. In this case, we can modify the old test to align with the correct behavior by updating its expectations to match the correct implementation. These tests inherintly verify different aspects of the functionality but can be adjusted to ensure they all validate the correct behavior. Keep them all (without any "(after fix)" in the name).
      </example>
    - or merge them with new tests if that makes sense
      <example>
      Let's assume an old test for the incorrect behavior was called "places market order" and the new test for the correct behavior is called "places market order with validation". If the new test is basically the same as the old test but with additional validation steps, we can merge them into a single test called "places market order" that includes all necessary checks. This way, we retain the original intent while ensuring the test reflects the correct behavior.
      </example>
4. Refactor the code to improve it while ensuring all tests still pass.
    - think about a better structure, naming, separation of concerns, modularity, reusability, readability, maintainability, performance, etc. and make the necessary changes
    - apply any necessary code quality improvements
    - ensure 100% test coverage in all categories
    - ensure linting and formatting compliance
    - ensure knip reports no unused code
5. Commit the changes with a clear and concise commit message following the Conventional Commits specification. Push the changes.
6. Stop the sub agent.
7. Mark the discrepancy as resolved in docs/discrepancies.md.

Repeat (with the next discrepancy and a freshly spawned sub agent) until the implementation is verified to be correct.

### Task 15: Integration Testing
End-to-end testing of the complete system with mocked Trade Republic API.

### Task 16: Documentation
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
| 10 | completed | done | done | done |
| 11 | completed | done | done | done |
| 12 | completed | done | done | done |
| 13 | completed | N/A | done | done |
| 14 | pending | - | - | - |
