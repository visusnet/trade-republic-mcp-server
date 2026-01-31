/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Risk Management Tool Registry - Tests
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { RiskService } from '../services/RiskService';
import { RiskManagementToolRegistry } from './RiskManagementToolRegistry';

describe('RiskManagementToolRegistry', () => {
  let mockServer: McpServer;
  let registry: RiskManagementToolRegistry;
  let riskService: RiskService;

  beforeEach(() => {
    riskService = new RiskService();
    mockServer = {
      registerTool: jest.fn(),
    } as unknown as McpServer;
    registry = new RiskManagementToolRegistry(mockServer, riskService);
  });

  describe('register', () => {
    it('should register calculate_position_size tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'calculate_position_size',
        expect.objectContaining({
          title: 'Calculate Position Size',
          description: expect.stringContaining('Kelly Criterion'),
        }),
        expect.any(Function),
      );
    });

    it('should register get_risk_metrics tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_risk_metrics',
        expect.objectContaining({
          title: 'Get Risk Metrics',
          description: expect.stringContaining('risk metrics'),
        }),
        expect.any(Function),
      );
    });

    it('should register both tools', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculate_position_size tool', () => {
    it('should execute with valid input', async () => {
      registry.register();

      const calls = (mockServer.registerTool as jest.Mock).mock.calls;
      const calculatePositionSizeCall = calls.find(
        (call) => call[0] === 'calculate_position_size',
      );
      const handler = calculatePositionSizeCall[2];

      const input = {
        accountBalance: 10000,
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      };

      const result = await handler(input);

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('kellyPercentage');
      expect(response).toHaveProperty('adjustedPercentage');
      expect(response).toHaveProperty('positionSizeAmount');
    });

    it('should handle errors gracefully', async () => {
      // Create a new service that throws
      const errorService = new RiskService();
      jest
        .spyOn(errorService, 'calculatePositionSize')
        .mockImplementation(() => {
          throw new Error('Test error');
        });

      const errorRegistry = new RiskManagementToolRegistry(
        mockServer,
        errorService,
      );
      errorRegistry.register();

      const calls = (mockServer.registerTool as jest.Mock).mock.calls;
      const calculatePositionSizeCall = calls.find(
        (call) => call[0] === 'calculate_position_size',
      );
      const handler = calculatePositionSizeCall[2];

      const input = {
        accountBalance: 10000,
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      };

      const result = await handler(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Test error');
    });
  });

  describe('get_risk_metrics tool', () => {
    it('should execute with valid input', async () => {
      registry.register();

      const calls = (mockServer.registerTool as jest.Mock).mock.calls;
      const getRiskMetricsCall = calls.find(
        (call) => call[0] === 'get_risk_metrics',
      );
      const handler = getRiskMetricsCall[2];

      const input = {
        prices: [100, 110, 105, 115, 112],
      };

      const result = await handler(input);

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('volatility');
      expect(response).toHaveProperty('valueAtRisk');
      expect(response).toHaveProperty('maxDrawdown');
      expect(response).toHaveProperty('sharpeRatio');
    });

    it('should use default parameters', async () => {
      registry.register();

      const calls = (mockServer.registerTool as jest.Mock).mock.calls;
      const getRiskMetricsCall = calls.find(
        (call) => call[0] === 'get_risk_metrics',
      );
      const handler = getRiskMetricsCall[2];

      const input = {
        prices: [100, 110],
      };

      const result = await handler(input);

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.timeframe).toBe('daily');
      expect(response.valueAtRisk.confidenceLevel).toBe('0.95');
    });

    it('should handle errors gracefully', async () => {
      // Create a new service that throws
      const errorService = new RiskService();
      jest.spyOn(errorService, 'getRiskMetrics').mockImplementation(() => {
        throw new Error('Test error');
      });

      const errorRegistry = new RiskManagementToolRegistry(
        mockServer,
        errorService,
      );
      errorRegistry.register();

      const calls = (mockServer.registerTool as jest.Mock).mock.calls;
      const getRiskMetricsCall = calls.find(
        (call) => call[0] === 'get_risk_metrics',
      );
      const handler = getRiskMetricsCall[2];

      const input = {
        prices: [100, 110],
      };

      const result = await handler(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Test error');
    });

    it('should handle custom parameters', async () => {
      registry.register();

      const calls = (mockServer.registerTool as jest.Mock).mock.calls;
      const getRiskMetricsCall = calls.find(
        (call) => call[0] === 'get_risk_metrics',
      );
      const handler = getRiskMetricsCall[2];

      const input = {
        prices: [100, 110, 105, 115],
        riskFreeRate: 0.03,
        confidenceLevel: '0.99' as const,
        timeframe: 'weekly' as const,
      };

      const result = await handler(input);

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.timeframe).toBe('weekly');
      expect(response.valueAtRisk.confidenceLevel).toBe('0.99');
    });
  });
});
