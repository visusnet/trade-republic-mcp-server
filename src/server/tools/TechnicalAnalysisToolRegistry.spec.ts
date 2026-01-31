/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { TechnicalAnalysisToolRegistry } from './TechnicalAnalysisToolRegistry';
import type { TechnicalAnalysisService } from '../services/TechnicalAnalysisService';
import type {
  GetIndicatorsResponse,
  GetDetailedAnalysisResponse,
} from '../services/TechnicalAnalysisService.response';

/**
 * Creates a mock TechnicalAnalysisService for testing.
 */
function createMockTechnicalAnalysisService(): jest.Mocked<TechnicalAnalysisService> {
  return {
    getIndicators:
      jest.fn<(request: unknown) => Promise<GetIndicatorsResponse>>(),
    getDetailedAnalysis:
      jest.fn<(request: unknown) => Promise<GetDetailedAnalysisResponse>>(),
  } as unknown as jest.Mocked<TechnicalAnalysisService>;
}

describe('TechnicalAnalysisToolRegistry', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockService: jest.Mocked<TechnicalAnalysisService>;
  let registry: TechnicalAnalysisToolRegistry;

  beforeEach(() => {
    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockService = createMockTechnicalAnalysisService();
    registry = new TechnicalAnalysisToolRegistry(mockServer, mockService);
  });

  describe('register', () => {
    it('should register get_indicators tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_indicators',
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_detailed_analysis tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_detailed_analysis',
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register exactly 2 tools', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('get_indicators tool', () => {
    it('should call getIndicators on service', async () => {
      const mockResponse: GetIndicatorsResponse = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        candleCount: 50,
        indicators: [{ type: 'RSI', period: 14, value: 55.5 }],
        timestamp: '2026-01-31T12:00:00.000Z',
      };

      mockService.getIndicators.mockResolvedValue(mockResponse);
      registry.register();

      // Get the registered handler
      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_indicators',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(mockService.getIndicators).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify(mockResponse, null, 2) },
        ],
        isError: false,
      });
    });

    it('should return error response when service throws', async () => {
      mockService.getIndicators.mockRejectedValue(
        new Error('Not authenticated'),
      );
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_indicators',
      );
      const handler = registerCall![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'DE0007164600',
        range: '3m',
        indicators: [{ type: 'RSI' }],
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Not authenticated' }],
        isError: true,
      });
    });
  });

  describe('get_detailed_analysis tool', () => {
    it('should call getDetailedAnalysis on service', async () => {
      const mockResponse: GetDetailedAnalysisResponse = {
        isin: 'DE0007164600',
        exchange: 'LSX',
        range: '3m',
        currentPrice: 100.5,
        summary: {
          overallSignal: 'hold',
          confidence: 50,
          score: 0,
          bullishCount: 1,
          bearishCount: 1,
          neutralCount: 2,
        },
        trend: {
          direction: 'sideways',
          strength: 'weak',
          sma20: 100,
          sma50: 99,
        },
        signals: [],
        indicators: {
          rsi: 50,
          macd: { macd: 0.5, signal: 0.4, histogram: 0.1 },
          bollingerBands: { upper: 105, middle: 100, lower: 95, pb: 0.5 },
          stochastic: { k: 50, d: 50 },
          adx: 20,
          atr: 2.5,
        },
        timestamp: '2026-01-31T12:00:00.000Z',
      };

      mockService.getDetailedAnalysis.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_detailed_analysis',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'DE0007164600',
      });

      expect(mockService.getDetailedAnalysis).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify(mockResponse, null, 2) },
        ],
        isError: false,
      });
    });

    it('should return error response when service throws', async () => {
      mockService.getDetailedAnalysis.mockRejectedValue(
        new Error('Insufficient candle data'),
      );
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_detailed_analysis',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'DE0007164600',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Insufficient candle data' }],
        isError: true,
      });
    });

    it('should pass optional parameters to service', async () => {
      const mockResponse: GetDetailedAnalysisResponse = {
        isin: 'DE0007164600',
        exchange: 'XETRA',
        range: '1y',
        currentPrice: 100.5,
        summary: {
          overallSignal: 'hold',
          confidence: 50,
          score: 0,
          bullishCount: 1,
          bearishCount: 1,
          neutralCount: 2,
        },
        trend: {
          direction: 'sideways',
          strength: 'weak',
          sma20: 100,
          sma50: 99,
        },
        signals: [],
        indicators: {
          rsi: 50,
          macd: { macd: 0.5, signal: 0.4, histogram: 0.1 },
          bollingerBands: { upper: 105, middle: 100, lower: 95, pb: 0.5 },
          stochastic: { k: 50, d: 50 },
          adx: 20,
          atr: 2.5,
        },
        timestamp: '2026-01-31T12:00:00.000Z',
      };

      mockService.getDetailedAnalysis.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_detailed_analysis',
      )![2] as (input: unknown) => Promise<unknown>;

      await handler({
        isin: 'DE0007164600',
        range: '1y',
        exchange: 'XETRA',
      });

      expect(mockService.getDetailedAnalysis).toHaveBeenCalledWith({
        isin: 'DE0007164600',
        range: '1y',
        exchange: 'XETRA',
      });
    });
  });

  describe('tool descriptions', () => {
    it('should have descriptive title for get_indicators', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_indicators',
      )! as [string, { title: string }, unknown];

      expect(registerCall[1].title).toBe('Get Indicators');
    });

    it('should have descriptive title for get_detailed_analysis', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_detailed_analysis',
      )! as [string, { title: string }, unknown];

      expect(registerCall[1].title).toBe('Get Detailed Analysis');
    });
  });
});
