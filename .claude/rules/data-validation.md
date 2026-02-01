---
description: Data validation rules
globs: ["src/**/*.ts"]
---

## Zod Required

- All request inputs: Zod schema
- All API responses: Zod schema
- Use `.passthrough()` until API format is confirmed

## Error Classes

Create specific error classes extending base errors with meaningful messages.
