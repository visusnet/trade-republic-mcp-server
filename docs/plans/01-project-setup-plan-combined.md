# Task 01: Project Setup - Combined Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize the TypeScript project with all required tooling following coinbase-mcp-server patterns.

**Architecture:** ESM TypeScript project with MCP SDK, Express, Zod, and standard dev tooling (ESLint, Prettier, Jest, Rollup, Knip).

**Tech Stack:** TypeScript, Node.js 24.12.0, ESM modules, Jest, ESLint, Prettier, Rollup, Knip, Zod

---

## Merge Notes

This plan combines the best elements from Plan 1 and Plan 2:
- **Version 0.1.0** (from Plan 1) - appropriate for initial development
- **Logger module included** (from Plan 2) - provides useful infrastructure with proper TDD
- **Comprehensive verification** (from Plan 2) - ensures all tooling works together

---

## Prerequisites

- Node.js >= 24.12.0 installed
- npm available
- Git repository already initialized

---

## Step 1: Create .nvmrc

**Files:**
- Create: `.nvmrc`

**Content:**
```
24.12.0
```

**Verification:**
```bash
cat .nvmrc
```
Expected output: `24.12.0`

---

## Step 2: Create package.json

**Files:**
- Create: `package.json`

**Content:**
```json
{
  "name": "trade-republic-mcp-server",
  "version": "0.1.0",
  "description": "MCP server for Trade Republic autonomous trading",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "trade-republic-mcp-server": "dist/index.js"
  },
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "rollup -c",
    "build:watch": "rollup -c --watch",
    "start": "node dist/index.js",
    "start:dev": "tsx --watch src/index.ts",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:types": "tsc --noEmit",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check .",
    "knip": "knip"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "trade-republic",
    "trading",
    "autonomous"
  ],
  "author": "Alexander Rose",
  "license": "MIT",
  "engines": {
    "node": ">=24.12.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.2",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "pino": "^10.3.0",
    "pino-pretty": "^13.1.3",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@jest/globals": "^29.7.0",
    "@rollup/plugin-commonjs": "^28.0.2",
    "@rollup/plugin-json": "^6.1.0",
    "@rollup/plugin-node-resolve": "^16.0.0",
    "@rollup/plugin-typescript": "^12.1.2",
    "@types/express": "^5.0.6",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.5",
    "eslint": "^9.17.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-jest": "^29.12.1",
    "eslint-plugin-prettier": "^5.5.4",
    "globals": "^15.14.0",
    "jest": "^29.7.0",
    "knip": "^5.80.0",
    "prettier": "^3.7.4",
    "rollup": "^4.30.1",
    "ts-jest": "^29.2.5",
    "tslib": "^2.8.1",
    "tsx": "^4.21.0",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.19.1"
  }
}
```

**Verification:**
```bash
node -e "const p = require('./package.json'); console.log(p.name, p.type, p.engines.node)"
```
Expected output: `trade-republic-mcp-server module >=24.12.0`

---

## Step 3: Create tsconfig.json

**Files:**
- Create: `tsconfig.json`

**Content:**
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2024"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": "./src",
    "paths": {
      "@server/*": ["server/*"],
      "@test/*": ["test/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Verification:**
```bash
node -e "const t = require('./tsconfig.json'); console.log(t.compilerOptions.target, t.compilerOptions.strict)"
```
Expected output: `ES2024 true`

---

## Step 4: Create tsconfig.build.json

**Files:**
- Create: `tsconfig.build.json`

**Content:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts", "node_modules"]
}
```

**Verification:**
```bash
node -e "const t = require('./tsconfig.build.json'); console.log('extends:', t.extends)"
```
Expected output: `extends: ./tsconfig.json`

---

## Step 5: Create eslint.config.js

**Files:**
- Create: `eslint.config.js`

**Content:**
```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier/recommended';
import jest from 'eslint-plugin-jest';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ['error', 'all'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      '@typescript-eslint/no-require-imports': 'off',
      'jest/expect-expect': [
        'error',
        { assertFunctionNames: ['expect', 'expectResponseToContain'] },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },
);
```

**Verification:**
```bash
head -5 eslint.config.js
```
Expected: First 5 lines showing imports.

---

## Step 6: Create .prettierrc.json

**Files:**
- Create: `.prettierrc.json`

**Content:**
```json
{
  "semi": true,
  "singleQuote": true
}
```

**Verification:**
```bash
cat .prettierrc.json
```
Expected: The JSON content.

---

## Step 7: Create jest.config.js

**Files:**
- Create: `jest.config.js`

**Content:**
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@server/(.*)$': '<rootDir>/src/server/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'NodeNext',
        },
      },
    ],
  },
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
```

**Verification:**
```bash
grep 'branches' jest.config.js
```
Expected: `branches: 100,`

---

## Step 8: Create rollup.config.js

**Files:**
- Create: `rollup.config.js`

**Content:**
```javascript
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  plugins: [
    resolve({
      preferBuiltins: true,
      exportConditions: ['import', 'module', 'node', 'default'],
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
  external: [
    /node_modules/,
  ],
};
```

**Verification:**
```bash
grep "format:" rollup.config.js
```
Expected: `format: 'esm',`

---

## Step 9: Create knip.json

**Files:**
- Create: `knip.json`

**Content:**
```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "project": ["src/**/*.ts"],
  "exclude": ["enumMembers", "types"]
}
```

**Verification:**
```bash
cat knip.json
```
Expected: The JSON content.

---

## Step 10: Create .gitignore

**Files:**
- Create: `.gitignore`

**Content:**
```
node_modules
dist
.env
*.log
.DS_Store
coverage
.claude/trading-state.json
```

**Verification:**
```bash
cat .gitignore
```
Expected: The gitignore content.

---

## Step 11: Create src directory structure

**Commands:**
```bash
mkdir -p src/server/tools src/server/services src/test
```

**Verification:**
```bash
ls -la src/ && ls -la src/server/
```
Expected: Shows server directory with tools and services subdirectories.

---

## Step 12: Create src/index.ts (placeholder)

**Files:**
- Create: `src/index.ts`

**Content:**
```typescript
#!/usr/bin/env node

console.log('Trade Republic MCP Server - placeholder');
```

**Verification:**
```bash
cat src/index.ts
```
Expected: The placeholder content.

---

## Step 13: Create src/logger.ts

**Files:**
- Create: `src/logger.ts`

**Content:**
```typescript
import pino from 'pino';
import pretty from 'pino-pretty';

/**
 * Fields to redact from all log output to prevent credential leakage.
 */
export const REDACT_PATHS = [
  'apiKey',
  'privateKey',
  'jwt',
  'token',
  'secret',
  'password',
  'pin',
  'phoneNumber',
  'TRADE_REPUBLIC_PHONE',
  'TRADE_REPUBLIC_PIN',
];

/**
 * Central pino configuration.
 * All logger instances are created from this base logger.
 */
const baseLogger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'debug',
    redact: REDACT_PATHS,
  },
  pretty({
    colorize: true,
    translateTime: 'HH:MM:ss.l',
    ignore: 'pid,hostname,scope',
    messageFormat: '[{scope}] {msg}',
  }),
);

/**
 * Creates a scoped logger instance.
 * @param scope - The scope/component name (e.g., 'WebSocket', 'Tools', 'Server')
 */
export function createLogger(scope: string): pino.Logger {
  return baseLogger.child({ scope });
}

/**
 * Pre-configured loggers for common scopes.
 */
export const logger = {
  server: createLogger('Server'),
  tools: createLogger('Tools'),
  api: createLogger('API'),
};
```

**Verification:**
```bash
grep 'TRADE_REPUBLIC' src/logger.ts
```
Expected: Shows TRADE_REPUBLIC_PHONE and TRADE_REPUBLIC_PIN entries.

---

## Step 14: Create src/logger.spec.ts

**Files:**
- Create: `src/logger.spec.ts`

**Content:**
```typescript
import { describe, it, expect } from '@jest/globals';
import { logger, createLogger, REDACT_PATHS } from './logger';

describe('logger', () => {
  describe('REDACT_PATHS', () => {
    it('should include sensitive field names', () => {
      expect(REDACT_PATHS).toContain('password');
      expect(REDACT_PATHS).toContain('pin');
      expect(REDACT_PATHS).toContain('TRADE_REPUBLIC_PHONE');
      expect(REDACT_PATHS).toContain('TRADE_REPUBLIC_PIN');
    });
  });

  describe('createLogger', () => {
    it('should create a logger with a scope', () => {
      const testLogger = createLogger('TestScope');
      expect(testLogger).toBeDefined();
      expect(typeof testLogger.info).toBe('function');
      expect(typeof testLogger.error).toBe('function');
    });
  });

  describe('pre-configured loggers', () => {
    it('should have server logger', () => {
      expect(logger.server).toBeDefined();
      expect(typeof logger.server.info).toBe('function');
    });

    it('should have tools logger', () => {
      expect(logger.tools).toBeDefined();
      expect(typeof logger.tools.info).toBe('function');
    });

    it('should have api logger', () => {
      expect(logger.api).toBeDefined();
      expect(typeof logger.api.info).toBe('function');
    });
  });
});
```

**Verification:**
```bash
grep 'describe' src/logger.spec.ts | wc -l
```
Expected: 4 (four describe blocks)

---

## Step 15: Install dependencies

**Commands:**
```bash
npm install
```

**Verification:**
```bash
npm ls @modelcontextprotocol/sdk zod jest
```
Expected: All packages listed with versions.

---

## Step 16: Verify TypeScript compilation

**Commands:**
```bash
npm run test:types
```

**Verification:**
Expected: No errors (exit code 0).

---

## Step 17: Verify ESLint works

**Commands:**
```bash
npm run lint
```

**Verification:**
Expected: No errors (exit code 0).

---

## Step 18: Format code with Prettier

**Commands:**
```bash
npm run format && npm run format:check
```

**Verification:**
Expected: No errors (exit code 0).

---

## Step 19: Run tests

**Commands:**
```bash
npm test
```

**Verification:**
Expected: All tests pass.

---

## Step 20: Verify build works

**Commands:**
```bash
npm run build
```

**Verification:**
```bash
ls dist/
```
Expected: Shows index.js and logger.js in dist directory.

---

## Step 21: Verify knip works

**Commands:**
```bash
npm run knip
```

**Verification:**
Expected: Knip runs successfully.

---

## Step 22: Complete verification

**Commands:**
```bash
npm run test:types && npm run lint && npm run test && npm run build
```

**Verification:**
All commands should complete successfully with exit code 0.

---

## Step 23: Commit project setup

**Commands:**
```bash
git add -A && git commit -m "feat: initialize TypeScript project with tooling

- Add package.json with ESM, MCP SDK, Zod, and dev tooling
- Add tsconfig.json and tsconfig.build.json for TypeScript
- Add eslint.config.js with strict TypeScript rules
- Add .prettierrc.json for code formatting
- Add jest.config.js with 100% coverage threshold
- Add rollup.config.js for ESM bundling
- Add knip.json for unused code detection
- Add .nvmrc for Node.js version pinning
- Add .gitignore for build artifacts
- Add src/logger.ts with credential redaction
- Add src/logger.spec.ts with tests
- Add placeholder src/index.ts entry point

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Verification:**
```bash
git log --oneline -1
```
Expected: Shows the commit.

---

## Summary

| Step | File/Action |
|------|-------------|
| 1 | .nvmrc |
| 2 | package.json |
| 3 | tsconfig.json |
| 4 | tsconfig.build.json |
| 5 | eslint.config.js |
| 6 | .prettierrc.json |
| 7 | jest.config.js |
| 8 | rollup.config.js |
| 9 | knip.json |
| 10 | .gitignore |
| 11 | Create src directories |
| 12 | src/index.ts |
| 13 | src/logger.ts |
| 14 | src/logger.spec.ts |
| 15 | npm install |
| 16 | Verify TypeScript |
| 17 | Verify ESLint |
| 18 | Format with Prettier |
| 19 | Run tests |
| 20 | Verify build |
| 21 | Verify knip |
| 22 | Complete verification |
| 23 | Git commit |

---

## Files Created

1. `.nvmrc`
2. `package.json`
3. `tsconfig.json`
4. `tsconfig.build.json`
5. `eslint.config.js`
6. `.prettierrc.json`
7. `jest.config.js`
8. `rollup.config.js`
9. `knip.json`
10. `.gitignore`
11. `src/index.ts`
12. `src/logger.ts`
13. `src/logger.spec.ts`

## Directories Created

1. `src/`
2. `src/server/`
3. `src/server/tools/`
4. `src/server/services/`
5. `src/test/`
