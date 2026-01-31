---
description: Code quality standards for TypeScript implementation
globs: ["src/**/*.ts"]
---

# Code Quality Rules

## Explicit public visibility modifiers

All intentionally public methods MUST have explicit `public` visibility modifier. This distinguishes intentional public APIs from methods that were accidentally left public.

```typescript
// GOOD
public async getPrice(request: GetPriceRequest): Promise<GetPriceResponse> { ... }

// BAD - missing explicit public
async getPrice(request: GetPriceRequest): Promise<GetPriceResponse> { ... }
```

## Only export what is actually used

- Internal schemas and types should NOT be exported
- Barrel files (index.ts) must only re-export items that are imported elsewhere
- Run `npm run knip` to detect unused exports

```typescript
// GOOD - internal schema, not exported
const InternalSchema = z.object({ ... });

// GOOD - exported because used by other modules
export const PublicSchema = z.object({ ... });
```

## Avoid .passthrough() in Zod schemas

Response schemas should be strict. Avoid `.passthrough()` as it:
- Masks API changes
- Reduces type safety
- Makes debugging harder

If the exact API response format is unknown, document the uncertainty and plan to remove `.passthrough()` once verified.
