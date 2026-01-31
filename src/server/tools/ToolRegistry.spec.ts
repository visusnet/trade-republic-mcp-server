import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { ToolRegistry, type ToolResult } from './ToolRegistry';

class TestToolRegistry extends ToolRegistry {
  public register(): void {}

  public exposeRegisterTool<S extends z.ZodRawShape>(
    name: string,
    options: {
      title: string;
      description: string;
      inputSchema: S;
    },
    fn: (input: z.output<z.ZodObject<S>>) => unknown,
  ): void {
    this.registerTool(name, options, fn);
  }
}

describe('ToolRegistry', () => {
  let mockServer: { registerTool: jest.Mock };
  let registry: TestToolRegistry;

  beforeEach(() => {
    mockServer = { registerTool: jest.fn() };
    registry = new TestToolRegistry(mockServer as unknown as McpServer);
  });

  describe('registerTool', () => {
    it('should register a tool with the MCP server', () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockReturnValue({ success: true });

      registry.exposeRegisterTool(
        'test_tool',
        { title: 'Test Tool', description: 'A test tool', inputSchema: schema },
        handler,
      );

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'test_tool',
        { title: 'Test Tool', description: 'A test tool', inputSchema: schema },
        expect.any(Function),
      );
    });

    it('should wrap handler with logging and return success result', async () => {
      const schema = { id: z.string() };
      const handler = jest.fn().mockReturnValue({ data: 'test' });

      registry.exposeRegisterTool(
        'test_tool',
        { title: 'Test Tool', description: 'A test tool', inputSchema: schema },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '123' });

      expect(logger.tools.info).toHaveBeenCalledWith('test_tool called');
      expect(logger.tools.debug).toHaveBeenCalledWith(
        { id: '123' },
        'test_tool parameters',
      );
      expect(handler).toHaveBeenCalledWith({ id: '123' });
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify({ data: 'test' }, null, 2) },
        ],
        isError: false,
      });
    });

    it('should handle async handlers', async () => {
      const schema = { id: z.string() };
      const handler = jest
        .fn<() => Promise<{ async: boolean }>>()
        .mockResolvedValue({ async: true });

      registry.exposeRegisterTool(
        'async_tool',
        {
          title: 'Async Tool',
          description: 'An async tool',
          inputSchema: schema,
        },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '456' });

      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify({ async: true }, null, 2) },
        ],
        isError: false,
      });
    });

    it('should handle Error objects and return error result', async () => {
      const schema = { id: z.string() };
      const handler = jest
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error('Test error'));

      registry.exposeRegisterTool(
        'error_tool',
        {
          title: 'Error Tool',
          description: 'A tool that errors',
          inputSchema: schema,
        },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '789' });

      expect(logger.tools.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'error_tool failed',
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Test error' }],
        isError: true,
      });
    });

    it('should handle non-Error objects and return error result', async () => {
      const schema = { id: z.string() };
      const handler = jest
        .fn<() => Promise<never>>()
        .mockRejectedValue('String error');

      registry.exposeRegisterTool(
        'string_error_tool',
        {
          title: 'String Error Tool',
          description: 'Throws string',
          inputSchema: schema,
        },
        handler,
      );

      const wrappedHandler = mockServer.registerTool.mock.calls[0][2] as (
        input: unknown,
      ) => Promise<ToolResult>;

      const result = await wrappedHandler({ id: '000' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'String error' }],
        isError: true,
      });
    });
  });
});
