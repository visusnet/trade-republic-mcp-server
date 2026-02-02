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
    // Transform ESM-only packages like p-throttle
    'node_modules/p-throttle/.+\\.js$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  // Transform ESM-only packages like p-throttle
  transformIgnorePatterns: ['node_modules/(?!(p-throttle)/)'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
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
