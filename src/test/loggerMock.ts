import { jest, beforeEach } from '@jest/globals';

export interface LoggerScope {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
}

export interface MockedLogger {
  server: LoggerScope;
  tools: LoggerScope;
  api: LoggerScope;
}

function createLoggerScope(): LoggerScope {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}

export function mockLogger(): MockedLogger {
  const logger: MockedLogger = {
    server: createLoggerScope(),
    tools: createLoggerScope(),
    api: createLoggerScope(),
  };

  beforeEach(() => {
    logger.server.info.mockClear();
    logger.server.error.mockClear();
    logger.server.warn.mockClear();
    logger.server.debug.mockClear();
    logger.tools.info.mockClear();
    logger.tools.error.mockClear();
    logger.tools.warn.mockClear();
    logger.tools.debug.mockClear();
    logger.api.info.mockClear();
    logger.api.error.mockClear();
    logger.api.warn.mockClear();
    logger.api.debug.mockClear();
  });

  return logger;
}
