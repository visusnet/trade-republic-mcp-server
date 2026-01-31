# Task 01: Project Setup - Implementation Plan (Sub-agent 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize the TypeScript project with all required tooling following coinbase-mcp-server patterns.

**Architecture:** ESM TypeScript project with MCP SDK, Express, Zod, and standard dev tooling (ESLint, Prettier, Jest, Rollup, Knip).

**Tech Stack:** TypeScript, Node.js 24.12.0, ESM modules, Jest, ESLint, Prettier, Rollup, Knip, Zod

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
node -e "const t = require('./tsconfig.json'); console.log(t.compilerOptions.target, t.compilerOptions.module, t.compilerOptions.strict)"
```
Expected output: `ES2024 ESNext true`

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
node -e "const t = require('./tsconfig.build.json'); console.log('extends:', t.extends, 'excludes specs:', t.exclude.includes('src/**/*.spec.ts'))"
```
Expected output: `extends: ./tsconfig.json excludes specs: true`

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
node -e "import('./jest.config.js').then(c => console.log(c.default.preset, c.default.coverageThreshold.global.lines))"
```
Expected: `ts-jest/presets/default-esm 100`

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
node -e "import('./rollup.config.js').then(c => console.log(c.default.input, c.default.output.format))"
```
Expected: `src/index.ts esm`

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
ls -la src/
ls -la src/server/
```
Expected: Shows server directory with tools and services subdirectories.

---

## Step 12: Create placeholder src/index.ts

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

## Step 13: Install dependencies

**Commands:**
```bash
npm install
```

**Verification:**
```bash
node -v && npm ls @modelcontextprotocol/sdk zod
```
Expected: Node version 24.x and listing of MCP SDK and Zod packages.

---

## Step 14: Verify TypeScript compilation

**Commands:**
```bash
npm run test:types
```

**Verification:**
Expected: No errors (exit code 0).

---

## Step 15: Verify ESLint works

**Commands:**
```bash
npm run lint
```

**Verification:**
Expected: No errors (exit code 0).

---

## Step 16: Verify Prettier works

**Commands:**
```bash
npm run format:check
```

**Verification:**
Expected: All files formatted or list of unformatted files.

---

## Step 17: Verify build works

**Commands:**
```bash
npm run build
```

**Verification:**
```bash
ls dist/
```
Expected: Shows index.js and related files in dist directory.

---

## Step 18: Create initial test file

**Files:**
- Create: `src/index.spec.ts`

**Content:**
```typescript
import { describe, it, expect } from '@jest/globals';

describe('Project Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true);
  });
});
```

**Verification:**
```bash
npm test
```
Expected: Test passes (1 test, 1 passing).

---

## Step 19: Verify knip works

**Commands:**
```bash
npm run knip
```

**Verification:**
Expected: Knip runs (may report unused items, that's expected at this stage).

---

## Step 20: Commit initial project setup

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
- Add placeholder src/index.ts entry point
- Add initial test file for Jest verification"
```

**Verification:**
```bash
git log --oneline -1
```
Expected: Shows the commit with "feat: initialize TypeScript project with tooling".

---

## Summary

| Step | File/Action | Duration |
|------|-------------|----------|
| 1 | .nvmrc | 2 min |
| 2 | package.json | 5 min |
| 3 | tsconfig.json | 3 min |
| 4 | tsconfig.build.json | 2 min |
| 5 | eslint.config.js | 3 min |
| 6 | .prettierrc.json | 2 min |
| 7 | jest.config.js | 3 min |
| 8 | rollup.config.js | 3 min |
| 9 | knip.json | 2 min |
| 10 | .gitignore | 2 min |
| 11 | Create src directories | 2 min |
| 12 | src/index.ts | 3 min |
| 13 | npm install | 3 min |
| 14 | Verify TypeScript | 2 min |
| 15 | Verify ESLint | 2 min |
| 16 | Verify Prettier | 2 min |
| 17 | Verify build | 2 min |
| 18 | src/index.spec.ts | 3 min |
| 19 | Verify knip | 2 min |
| 20 | Git commit | 3 min |

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
12. `src/index.spec.ts`

## Directories Created

1. `src/`
2. `src/server/`
3. `src/server/tools/`
4. `src/server/services/`
5. `src/test/`
