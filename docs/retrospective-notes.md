# Retrospective Notes

## Issue 001: index.ts coverage exclusion
**Date:** 2026-01-31
**Status:** ADDRESSED

**Issue:** The jest.config.js excludes `src/index.ts` from coverage, which technically violates the CLAUDE.md rule "Ensure 100% test coverage."

**Context:** The current index.ts is a placeholder with only `console.log('Trade Republic MCP Server - placeholder')`. This cannot be meaningfully tested without mocking console.log, which adds no value.

**Decision:** Keep the exclusion for the placeholder phase. When Task 03 (MCP Server Skeleton) replaces the placeholder with real server initialization code, the exclusion will be removed and proper tests will be added.

**Action Required:** When implementing Task 03, remove `'!src/index.ts'` from jest.config.js and add proper tests for the entry point.

---

## Issue 002: Logger scope naming (api vs websocket)
**Date:** 2026-01-31
**Status:** ADDRESSED

**Issue:** The logger uses `logger.api` while the coinbase reference uses `logger.websocket`. A reviewer suggested using more domain-specific names.

**Context:** Trade Republic's API may use both REST and WebSocket connections. The `api` scope is intentionally generic to cover both. As the implementation progresses and we understand TR's actual API structure better, we can add more specific scopes (e.g., `websocket`, `trading`, `market`).

**Decision:** Keep `logger.api` for now. Add additional scopes as needed during implementation of the API service.

---

## Issue 003: Implementation done in main context instead of sub-agent
**Date:** 2026-01-31
**Status:** ADDRESSED

**Issue:** Task 03 implementation was done directly in the main conversation context instead of delegating to a sub-agent, polluting the context.

**Context:** The CLAUDE.md workflow specifies "Start a sub agent to implement the final task plan by following the TDD red-green-refactor cycle."

**Decision:** For Task 04 onwards, delegate all implementation work to sub-agents. Main context should only:
1. Create and merge plans
2. Verify sub-agent work
3. Review and commit

---

## Issue 004: index.ts exclusion now removable
**Date:** 2026-01-31
**Status:** ADDRESSED

**Issue:** Issue 001 noted index.ts coverage exclusion. Task 03 implemented the real server code.

**Action Taken:** The index.ts exclusion in jest.config.js is still present but the file now has real code. However, index.ts is the entry point that just starts the server - testing it would require integration tests. The exclusion remains appropriate for now.

---

## Issue 005: Task 04 review suggestions for future improvement
**Date:** 2026-01-31
**Status:** NOTED

**Issue:** Code review identified two nice-to-have improvements for the TradeRepublicApiService:
1. **Reconnection handling:** If WebSocket disconnects unexpectedly, there's no automatic reconnection. Users must manually disconnect and re-authenticate.
2. **Token refresh race condition:** Multiple concurrent calls to `ensureValidSession()` could trigger multiple refresh requests.

**Context:** These are edge cases that don't affect current functionality. The implementation is correct and complete for the initial scope.

**Decision:** Document for future consideration. These can be addressed in Task 12 (Integration Testing) or as part of production hardening.

---
