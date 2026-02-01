# ADR-014: Follow Existing MCP Server Patterns

**Status:** Accepted
**Date:** 2026-01-31
**Decision Makers:** Alexander Rose, Claude

## Context

A reference implementation exists in the coinbase-mcp-server project. The Trade Republic bot needs consistent architecture for maintainability.

## Problem

What patterns and conventions should the MCP server follow?

## Decision

**Follow patterns from coinbase-mcp-server reference project.**

## Adopted Patterns

### Service Architecture
- Service classes with dependency injection
- Services have no direct dependencies on each other
- All services are instantiated by the MCP server

### Tool Registries
- Tool registries extend base `ToolRegistry` class
- Each domain has its own registry (Portfolio, Market, Execution, etc.)
- Registries handle logging and error wrapping

### Data Validation
- Zod schemas for all request/response validation
- Request schemas in `*.request.ts` files
- Response schemas in `*.response.ts` files
- Type exports via `*.types.ts` files

### Testing
- Jest for testing with 100% coverage requirement
- Tests co-located with source (`*.spec.ts`)
- Mocks in `src/test/` directory

### Code Quality
- ESLint with TypeScript strict rules
- Prettier for formatting
- Knip for unused code detection

### Build
- Rollup for ESM bundling
- TypeScript with strict mode
- ES2024 target

## File Structure Convention

```
src/server/services/
├── ServiceName.ts           # Main implementation
├── ServiceName.spec.ts      # Tests
├── ServiceName.request.ts   # Input Zod schemas
├── ServiceName.response.ts  # Output Zod schemas
└── ServiceName.types.ts     # TypeScript types, constants, errors

src/server/tools/
├── ToolRegistry.ts          # Base class
├── DomainToolRegistry.ts    # Domain-specific registry
└── DomainToolRegistry.spec.ts
```

## Rationale

- Proven architecture from working project
- Consistent conventions reduce cognitive load
- Existing tooling configuration can be reused
- Onboarding is easier with familiar patterns

## Consequences

### Positive
- Consistent codebase
- Predictable file locations
- Shared knowledge between projects
- Existing tooling works out of the box

### Negative
- Locked into specific patterns
- May not be optimal for all situations
- Learning curve for new patterns

## References

- coinbase-mcp-server reference project (../coinbase-mcp-server)
- ADR-010: Same Architecture as Coinbase MCP
