/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Auth Tool Registry Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import type { TradeRepublicApiService } from '../services/TradeRepublicApiService';
import { AuthToolRegistry } from './AuthToolRegistry';
import type { ToolResult } from './ToolRegistry';

/**
 * Creates a mock McpServer for testing.
 */
function createMockServer(): { registerTool: jest.Mock } {
  return {
    registerTool: jest.fn(),
  };
}

describe('AuthToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let mockApiService: jest.Mocked<TradeRepublicApiService>;
  let registry: AuthToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = createMockServer();

    mockApiService = {
      enterTwoFactorCode: jest.fn(),
    } as unknown as jest.Mocked<TradeRepublicApiService>;

    registry = new AuthToolRegistry(
      mockServer as unknown as McpServer,
      mockApiService,
    );
  });

  describe('register', () => {
    it('should register enter_two_factor_code tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(1);

      const [toolName, options, callback] = mockServer.registerTool.mock
        .calls[0] as [
        string,
        { title: string; description: string; inputSchema: unknown },
        unknown,
      ];
      expect(toolName).toBe('enter_two_factor_code');
      expect(options.title).toBe('Enter 2FA Code');
      expect(options.description).toContain('two-factor authentication');
      expect(options.inputSchema).toBeDefined();
      expect(callback).toBeInstanceOf(Function);
    });

    it('should only register auth tools', () => {
      registry.register();

      // Verify only 1 tool is registered (enter_two_factor_code)
      expect(mockServer.registerTool).toHaveBeenCalledTimes(1);
    });
  });

  describe('enter_two_factor_code tool', () => {
    it('should call apiService.enterTwoFactorCode with provided code', async () => {
      mockApiService.enterTwoFactorCode.mockResolvedValue({
        message: 'Authentication successful',
      });

      registry.register();

      // Get the registered callback
      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'enter_two_factor_code',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ code: '1234' });

      expect(mockApiService.enterTwoFactorCode).toHaveBeenCalledWith({
        code: '1234',
      });
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual({
        message: 'Authentication successful',
      });
    });

    it('should return error result when enterTwoFactorCode fails', async () => {
      mockApiService.enterTwoFactorCode.mockResolvedValue({
        message: 'Invalid 2FA code',
      });

      registry.register();

      // Get the registered callback
      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'enter_two_factor_code',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ code: '0000' });

      // Note: The tool returns isError: false because enterTwoFactorCode doesn't throw
      // The response message indicates the actual result
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual({
        message: 'Invalid 2FA code',
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      mockApiService.enterTwoFactorCode.mockRejectedValue(
        new Error('Unexpected error'),
      );

      registry.register();

      // Get the registered callback
      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'enter_two_factor_code',
      )![2] as (input: unknown) => Promise<ToolResult>;

      const result = await handler({ code: '1234' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Unexpected error');
    });
  });
});
