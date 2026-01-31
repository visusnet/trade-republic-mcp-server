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

import { ExternalDataToolRegistry } from './ExternalDataToolRegistry';
import type { NewsService } from '../services/NewsService';
import type { SentimentService } from '../services/SentimentService';
import type { FundamentalsService } from '../services/FundamentalsService';
import type { GetNewsResponse } from '../services/NewsService.response';
import type { GetSentimentResponse } from '../services/SentimentService.response';
import type { GetFundamentalsResponse } from '../services/FundamentalsService.response';

/**
 * Creates a mock NewsService for testing.
 */
function createMockNewsService(): jest.Mocked<NewsService> {
  return {
    getNews: jest.fn<(request: unknown) => Promise<GetNewsResponse>>(),
  } as unknown as jest.Mocked<NewsService>;
}

/**
 * Creates a mock SentimentService for testing.
 */
function createMockSentimentService(): jest.Mocked<SentimentService> {
  return {
    getSentiment:
      jest.fn<(request: unknown) => Promise<GetSentimentResponse>>(),
  } as unknown as jest.Mocked<SentimentService>;
}

/**
 * Creates a mock FundamentalsService for testing.
 */
function createMockFundamentalsService(): jest.Mocked<FundamentalsService> {
  return {
    getFundamentals:
      jest.fn<(request: unknown) => Promise<GetFundamentalsResponse>>(),
  } as unknown as jest.Mocked<FundamentalsService>;
}

describe('ExternalDataToolRegistry', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockNewsService: jest.Mocked<NewsService>;
  let mockSentimentService: jest.Mocked<SentimentService>;
  let mockFundamentalsService: jest.Mocked<FundamentalsService>;
  let registry: ExternalDataToolRegistry;

  beforeEach(() => {
    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockNewsService = createMockNewsService();
    mockSentimentService = createMockSentimentService();
    mockFundamentalsService = createMockFundamentalsService();
    registry = new ExternalDataToolRegistry(
      mockServer,
      mockNewsService,
      mockSentimentService,
      mockFundamentalsService,
    );
  });

  describe('register', () => {
    it('should register get_news tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_news',
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_sentiment tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_sentiment',
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register get_fundamentals tool', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'get_fundamentals',
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function),
      );
    });

    it('should register exactly 3 tools', () => {
      registry.register();

      expect(mockServer.registerTool).toHaveBeenCalledTimes(3);
    });
  });

  describe('get_news tool', () => {
    it('should call getNews on service', async () => {
      const mockResponse: GetNewsResponse = {
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'Apple announces new product',
            publisher: 'Reuters',
            link: 'https://example.com/news/1',
            publishedAt: '2024-01-15T10:00:00Z',
          },
        ],
        totalCount: 1,
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockNewsService.getNews.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_news',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'US0378331005',
        limit: 10,
      });

      expect(mockNewsService.getNews).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify(mockResponse, null, 2) },
        ],
        isError: false,
      });
    });

    it('should return error response when service throws', async () => {
      mockNewsService.getNews.mockRejectedValue(
        new Error('Failed to get news'),
      );
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_news',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'US0378331005',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Failed to get news' }],
        isError: true,
      });
    });
  });

  describe('get_sentiment tool', () => {
    it('should call getSentiment on service with text', async () => {
      const mockResponse: GetSentimentResponse = {
        overallScore: 50,
        overallDirection: 'positive',
        confidence: 'medium',
        analysis: [
          {
            text: 'Great news',
            score: 5,
            comparative: 2.5,
            direction: 'positive',
            positiveWords: ['great'],
            negativeWords: [],
          },
        ],
        summary: 'Sentiment analysis indicates positive sentiment.',
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockSentimentService.getSentiment.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_sentiment',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        text: 'Great news',
      });

      expect(mockSentimentService.getSentiment).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify(mockResponse, null, 2) },
        ],
        isError: false,
      });
    });

    it('should call getSentiment on service with isin', async () => {
      const mockResponse: GetSentimentResponse = {
        isin: 'US0378331005',
        symbol: 'AAPL',
        overallScore: 30,
        overallDirection: 'positive',
        confidence: 'low',
        analysis: [],
        summary: 'Analyzed 0 articles. Overall sentiment is positive.',
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockSentimentService.getSentiment.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_sentiment',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'US0378331005',
        newsLimit: 5,
      });

      expect(mockSentimentService.getSentiment).toHaveBeenCalledWith({
        isin: 'US0378331005',
        newsLimit: 5,
      });
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify(mockResponse, null, 2) },
        ],
        isError: false,
      });
    });

    it('should return error response when service throws', async () => {
      mockSentimentService.getSentiment.mockRejectedValue(
        new Error('Text cannot be empty'),
      );
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_sentiment',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        text: '',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Text cannot be empty' }],
        isError: true,
      });
    });
  });

  describe('get_fundamentals tool', () => {
    it('should call getFundamentals on service', async () => {
      const mockResponse: GetFundamentalsResponse = {
        isin: 'US0378331005',
        symbol: 'AAPL',
        profile: {
          name: 'Apple Inc.',
          sector: 'Technology',
        },
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockFundamentalsService.getFundamentals.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_fundamentals',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'US0378331005',
        modules: ['profile'],
      });

      expect(mockFundamentalsService.getFundamentals).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          { type: 'text', text: JSON.stringify(mockResponse, null, 2) },
        ],
        isError: false,
      });
    });

    it('should return error response when service throws', async () => {
      mockFundamentalsService.getFundamentals.mockRejectedValue(
        new Error('Symbol not found'),
      );
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_fundamentals',
      )![2] as (input: unknown) => Promise<unknown>;

      const result = await handler({
        isin: 'US0000000000',
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Symbol not found' }],
        isError: true,
      });
    });

    it('should pass modules to service', async () => {
      const mockResponse: GetFundamentalsResponse = {
        isin: 'US0378331005',
        symbol: 'AAPL',
        financials: { revenue: 100 },
        valuation: { marketCap: 1000 },
        timestamp: '2024-01-15T10:00:00Z',
      };

      mockFundamentalsService.getFundamentals.mockResolvedValue(mockResponse);
      registry.register();

      const handler = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_fundamentals',
      )![2] as (input: unknown) => Promise<unknown>;

      await handler({
        isin: 'US0378331005',
        modules: ['financials', 'valuation'],
      });

      expect(mockFundamentalsService.getFundamentals).toHaveBeenCalledWith({
        isin: 'US0378331005',
        modules: ['financials', 'valuation'],
      });
    });
  });

  describe('tool descriptions', () => {
    it('should have descriptive title for get_news', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_news',
      )! as [string, { title: string }, unknown];

      expect(registerCall[1].title).toBe('Get News');
    });

    it('should have descriptive title for get_sentiment', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_sentiment',
      )! as [string, { title: string }, unknown];

      expect(registerCall[1].title).toBe('Get Sentiment');
    });

    it('should have descriptive title for get_fundamentals', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_fundamentals',
      )! as [string, { title: string }, unknown];

      expect(registerCall[1].title).toBe('Get Fundamentals');
    });

    it('should mention no authentication required in get_news description', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_news',
      )! as [string, { description: string }, unknown];

      expect(registerCall[1].description.toLowerCase()).toContain(
        'no authentication required',
      );
    });

    it('should mention no authentication required in get_sentiment description', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_sentiment',
      )! as [string, { description: string }, unknown];

      expect(registerCall[1].description.toLowerCase()).toContain(
        'no authentication required',
      );
    });

    it('should mention no authentication required in get_fundamentals description', () => {
      registry.register();

      const registerCall = mockServer.registerTool.mock.calls.find(
        (call) => call[0] === 'get_fundamentals',
      )! as [string, { description: string }, unknown];

      expect(registerCall[1].description.toLowerCase()).toContain(
        'no authentication required',
      );
    });
  });
});
