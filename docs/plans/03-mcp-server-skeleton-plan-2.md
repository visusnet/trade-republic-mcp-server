# Task 03: MCP Server Skeleton - Implementation Plan 2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the TradeRepublicMcpServer class with MCP server instance, tool registry pattern, and assist prompt (no actual tools yet).

**Architecture:** Follows coinbase-mcp-server patterns - Express HTTP server with MCP SDK integration, abstract ToolRegistry base class, and assist prompt resource.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Express, Zod

---

## Design Decisions

### Pattern Analysis from coinbase-mcp-server

1. **CoinbaseMcpServer class structure:**
   - Creates Express app using `createMcpExpressApp()` from MCP SDK
   - Sets up `/mcp` routes (POST for requests, GET returns 405)
   - Creates new `McpServer` instances per request (stateless mode)
   - Registers tools via domain-specific ToolRegistry classes
   - Registers prompts directly on the server

2. **ToolRegistry pattern:**
   - Abstract base class with `register()` method
   - Protected `registerTool()` wrapper with logging/error handling
   - Concrete registries extend base, take `McpServer` and service in constructor

---

## TDD Implementation Sequence

### Step 1: Create test helper - loggerMock.ts
### Step 2: Create ToolRegistry.spec.ts (RED)
### Step 3: Create ToolRegistry.ts (GREEN)
### Step 4: Create TradeRepublicMcpServer.spec.ts (RED)
### Step 5: Create TradeRepublicMcpServer.ts (GREEN)
### Step 6: Install supertest dev dependency
### Step 7: Update src/index.ts
### Step 8: Create src/index.spec.ts
### Step 9: Run all tests with coverage
### Step 10: Run linting and formatting
### Step 11: Build the project
### Step 12: Run knip
### Step 13: Complete verification

---

## Files Created/Modified

**Created:**
1. `src/test/loggerMock.ts` - Reusable logger mock for tests
2. `src/server/tools/ToolRegistry.ts` - Abstract base class for tool registries
3. `src/server/tools/ToolRegistry.spec.ts` - Tests for ToolRegistry
4. `src/server/TradeRepublicMcpServer.ts` - Main MCP server class
5. `src/server/TradeRepublicMcpServer.spec.ts` - Tests for server
6. `src/index.spec.ts` - Tests for entry point

**Modified:**
1. `src/index.ts` - Updated to use TradeRepublicMcpServer
2. `package.json` - Added supertest and @types/supertest
