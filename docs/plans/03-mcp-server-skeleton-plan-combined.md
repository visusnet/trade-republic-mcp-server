# Task 03: MCP Server Skeleton - Combined Implementation Plan

## Overview

Create the TradeRepublicMcpServer class with MCP server instance, tool registry pattern, and assist prompt (no actual tools yet).

## Architecture

Follows coinbase-mcp-server patterns:
- Express HTTP server with MCP SDK integration
- Abstract ToolRegistry base class for tool registries
- Assist prompt resource for Claude context

## Tech Stack

TypeScript, @modelcontextprotocol/sdk, Express, Zod

## Files to Create

| File | Purpose |
|------|---------|
| `src/server/TradeRepublicMcpServer.ts` | Main server class |
| `src/server/TradeRepublicMcpServer.spec.ts` | Server tests |
| `src/server/tools/ToolRegistry.ts` | Abstract base for tool registries |
| `src/server/tools/ToolRegistry.spec.ts` | ToolRegistry tests |
| `src/test/loggerMock.ts` | Logger mock helper for tests |

## Implementation Steps

### Step 1: Create Logger Mock Helper

`src/test/loggerMock.ts` - Reusable mock for tests with server, tools, api scopes.

### Step 2: Create ToolRegistry Tests (RED)

Tests for:
- Registering tools with MCP server
- Wrapping handlers with logging on success
- Error handling for Error objects
- Error handling for non-Error throws
- Handling synchronous service methods

### Step 3: Implement ToolRegistry (GREEN)

Abstract class with:
- Constructor accepting McpServer
- Protected `registerTool()` wrapper with logging/error handling
- Abstract `register()` method for subclasses

### Step 4: Create TradeRepublicMcpServer Tests (RED)

Tests for:
- Server initialization
- Prompts registration (assist prompt)
- Empty tools list (skeleton)
- HTTP routes (GET 405, POST works, error handling)
- Server lifecycle (listen, shutdown, signal handlers)

### Step 5: Implement TradeRepublicMcpServer (GREEN)

Key features:
- Express app with `/mcp` routes
- Stateless MCP server instances per request
- Assist prompt with Trade Republic context
- Graceful shutdown with timeout

### Step 6: Install supertest dev dependency

```bash
npm install --save-dev supertest @types/supertest
```

### Step 7: Update index.ts

Update entry point to use TradeRepublicMcpServer.

### Step 8: Run Tests and Verify

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run build
```

Expected: 100% coverage, all tests passing.

## Design Decisions

### Pattern Analysis from coinbase-mcp-server

1. **Server class structure:**
   - Creates Express app using `createMcpExpressApp()` from MCP SDK
   - Sets up `/mcp` routes (POST for requests, GET returns 405)
   - Creates new `McpServer` instances per request (stateless mode)
   - Registers tools via domain-specific ToolRegistry classes
   - Registers prompts directly on the server

2. **ToolRegistry pattern:**
   - Abstract base class with `register()` method
   - Protected `registerTool()` wrapper with logging/error handling
   - Concrete registries extend base, take `McpServer` and service in constructor
