/**
 * Auth Tool Registry
 *
 * Registers MCP tools for authentication operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { TradeRepublicApiService } from '../services/TradeRepublicApiService';
import { EnterTwoFactorCodeRequestSchema } from '../services/TradeRepublicApiService.request';
import { ToolRegistry } from './ToolRegistry';

export class AuthToolRegistry extends ToolRegistry {
  constructor(
    server: McpServer,
    private readonly apiService: TradeRepublicApiService,
  ) {
    super(server);
  }

  public register(): void {
    this.registerTool(
      'enter_two_factor_code',
      {
        title: 'Enter 2FA Code',
        description:
          'Enter the two-factor authentication code received via SMS. ' +
          'Call this tool when you receive a TwoFactorCodeRequiredException ' +
          'after trying to use any other Trade Republic tool.',
        inputSchema: EnterTwoFactorCodeRequestSchema.shape,
      },
      this.apiService.enterTwoFactorCode.bind(this.apiService),
    );
  }
}
