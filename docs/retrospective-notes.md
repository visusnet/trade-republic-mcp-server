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
