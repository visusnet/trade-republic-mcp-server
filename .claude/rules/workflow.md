---
description: Workflow rules for task implementation and commits
globs: ["**/*"]
alwaysApply: true
---

# Workflow Rules

## Quality checks must pass before commit

Before any commit, run the full verification pipeline:

```bash
npm run test:types && npm run lint:fix && npm run format && npm run test:coverage && npm run knip && npm run build
```

All checks must pass. Fix any failures before committing.

## Delegate implementation to sub-agents

Implementation work should be delegated to sub-agents. Main context should only:

1. Create and merge plans
2. Verify sub-agent work
3. Review and commit

This prevents context pollution and keeps the main conversation focused.
