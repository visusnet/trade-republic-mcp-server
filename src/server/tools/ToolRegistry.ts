import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import { logger } from '../../logger';

export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError: boolean;
}

export abstract class ToolRegistry {
  constructor(private readonly server: McpServer) {}

  protected registerTool<S extends ZodRawShape>(
    name: string,
    options: {
      title: string;
      description: string;
      inputSchema: S;
    },
    fn: (input: z.output<z.ZodObject<S>>) => unknown,
  ): void {
    this.server.registerTool(
      name,
      options,
      this.call(name, fn) as Parameters<typeof this.server.registerTool>[2],
    );
  }

  private call<I>(toolName: string, fn: (input: I) => unknown) {
    return async (input: I): Promise<ToolResult> => {
      logger.tools.info(`${toolName} called`);
      logger.tools.debug(input as object, `${toolName} parameters`);
      try {
        const response = await Promise.resolve(fn(input));
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(response, null, 2) },
          ],
          isError: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.tools.error({ err: error }, `${toolName} failed`);
        return {
          content: [{ type: 'text' as const, text: message }],
          isError: true,
        };
      }
    };
  }

  public abstract register(): void;
}
