/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

const mockAnalyze = jest.fn();
jest.mock('sentiment', () => {
  return jest.fn().mockImplementation(() => ({
    analyze: mockAnalyze,
  }));
});

import { SentimentService } from './SentimentService';
import { SentimentServiceError } from './SentimentService.types';
import { GetSentimentRequestSchema } from './SentimentService.request';
import type { NewsService } from './NewsService';

describe('SentimentService', () => {
  let service: SentimentService;
  let mockNewsService: jest.Mocked<NewsService>;

  beforeEach(() => {
    mockAnalyze.mockReset();

    mockNewsService = {
      getNews: jest.fn(),
    } as unknown as jest.Mocked<NewsService>;

    service = new SentimentService(mockNewsService);
  });

  describe('getSentiment with text', () => {
    it('should analyze provided text', async () => {
      mockAnalyze.mockReturnValue({
        score: 5,
        comparative: 0.5,
        positive: ['great', 'excellent'],
        negative: [],
      });

      const result = await service.getSentiment({
        text: 'great excellent news',
      });

      expect(result.analysis).toHaveLength(1);
      expect(result.analysis[0].text).toBe('great excellent news');
      expect(result.analysis[0].score).toBe(5);
      expect(result.analysis[0].comparative).toBe(0.5);
      expect(result.analysis[0].positiveWords).toEqual(['great', 'excellent']);
      expect(result.analysis[0].negativeWords).toEqual([]);
    });

    it('should call sentiment analyzer with text and finance extras', async () => {
      mockAnalyze.mockReturnValue({
        score: 0,
        comparative: 0,
        positive: [],
        negative: [],
      });

      await service.getSentiment({ text: 'test text' });

      expect(mockAnalyze).toHaveBeenCalledWith('test text', expect.any(Object));
    });

    it('should not include isin/symbol for text-only analysis', async () => {
      mockAnalyze.mockReturnValue({
        score: 0,
        comparative: 0,
        positive: [],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'test' });

      expect(result.isin).toBeUndefined();
      expect(result.symbol).toBeUndefined();
    });

    it('should throw SentimentServiceError for empty text', async () => {
      await expect(service.getSentiment({ text: '' })).rejects.toThrow(
        SentimentServiceError,
      );
      await expect(service.getSentiment({ text: '' })).rejects.toThrow(
        'Text cannot be empty',
      );
    });

    it('should throw SentimentServiceError for whitespace-only text', async () => {
      await expect(service.getSentiment({ text: '   ' })).rejects.toThrow(
        'Text cannot be empty',
      );
    });
  });

  describe('getSentiment with isin', () => {
    it('should analyze news for ISIN', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'Apple stock rises',
            publisher: 'Reuters',
            link: 'https://example.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
        ],
        totalCount: 1,
        timestamp: '2024-01-15T10:00:00Z',
      });

      mockAnalyze.mockReturnValue({
        score: 3,
        comparative: 0.3,
        positive: ['rises'],
        negative: [],
      });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.isin).toBe('US0378331005');
      expect(result.symbol).toBe('AAPL');
      expect(result.analysis).toHaveLength(1);
    });

    it('should call newsService with ISIN and default limit', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [],
        totalCount: 0,
        timestamp: '2024-01-15T10:00:00Z',
      });

      await service.getSentiment({ isin: 'US0378331005' });

      expect(mockNewsService.getNews).toHaveBeenCalledWith({
        isin: 'US0378331005',
        limit: 5,
      });
    });

    it('should call newsService with custom limit', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [],
        totalCount: 0,
        timestamp: '2024-01-15T10:00:00Z',
      });

      await service.getSentiment({ isin: 'US0378331005', newsLimit: 10 });

      expect(mockNewsService.getNews).toHaveBeenCalledWith({
        isin: 'US0378331005',
        limit: 10,
      });
    });

    it('should handle empty news results', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [],
        totalCount: 0,
        timestamp: '2024-01-15T10:00:00Z',
      });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.analysis).toHaveLength(0);
      expect(result.overallScore).toBe(0);
      expect(result.overallDirection).toBe('neutral');
    });

    it('should throw SentimentServiceError when newsService fails', async () => {
      mockNewsService.getNews.mockRejectedValue(new Error('Network error'));

      await expect(
        service.getSentiment({ isin: 'US0378331005' }),
      ).rejects.toThrow(SentimentServiceError);
      await expect(
        service.getSentiment({ isin: 'US0378331005' }),
      ).rejects.toThrow('Failed to get sentiment: Network error');
    });
  });

  describe('sentiment direction calculation', () => {
    it('should return positive for comparative > 0.1', async () => {
      mockAnalyze.mockReturnValue({
        score: 5,
        comparative: 0.15,
        positive: ['good'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'good news' });

      expect(result.analysis[0].direction).toBe('positive');
    });

    it('should return negative for comparative < -0.1', async () => {
      mockAnalyze.mockReturnValue({
        score: -5,
        comparative: -0.15,
        positive: [],
        negative: ['bad'],
      });

      const result = await service.getSentiment({ text: 'bad news' });

      expect(result.analysis[0].direction).toBe('negative');
    });

    it('should return neutral for comparative between -0.1 and 0.1', async () => {
      mockAnalyze.mockReturnValue({
        score: 0,
        comparative: 0.05,
        positive: [],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'neutral news' });

      expect(result.analysis[0].direction).toBe('neutral');
    });

    it('should return neutral for comparative exactly at 0.1 threshold', async () => {
      mockAnalyze.mockReturnValue({
        score: 1,
        comparative: 0.1,
        positive: ['ok'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'ok news' });

      expect(result.analysis[0].direction).toBe('neutral');
    });

    it('should return neutral for comparative exactly at -0.1 threshold', async () => {
      mockAnalyze.mockReturnValue({
        score: -1,
        comparative: -0.1,
        positive: [],
        negative: ['meh'],
      });

      const result = await service.getSentiment({ text: 'meh news' });

      expect(result.analysis[0].direction).toBe('neutral');
    });
  });

  describe('overall score calculation', () => {
    it('should normalize score to -100 to 100 range', async () => {
      mockAnalyze.mockReturnValue({
        score: 10,
        comparative: 2.5, // Max 5 -> 100
        positive: ['great'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'great' });

      expect(result.overallScore).toBe(50); // 2.5 * 20 = 50
    });

    it('should clamp score to max 100', async () => {
      mockAnalyze.mockReturnValue({
        score: 50,
        comparative: 7.0, // Would be 140, clamped to 100
        positive: ['amazing'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'amazing' });

      expect(result.overallScore).toBe(100);
    });

    it('should clamp score to min -100', async () => {
      mockAnalyze.mockReturnValue({
        score: -50,
        comparative: -7.0, // Would be -140, clamped to -100
        positive: [],
        negative: ['terrible'],
      });

      const result = await service.getSentiment({ text: 'terrible' });

      expect(result.overallScore).toBe(-100);
    });

    it('should average scores for multiple texts', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'Good news',
            publisher: 'Reuters',
            link: 'https://example.com/1',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Bad news',
            publisher: 'Reuters',
            link: 'https://example.com/2',
            publishedAt: '2024-01-15T10:01:00Z',
          },
        ],
        totalCount: 2,
        timestamp: '2024-01-15T10:00:00Z',
      });

      mockAnalyze
        .mockReturnValueOnce({
          score: 5,
          comparative: 2.5, // 50
          positive: ['good'],
          negative: [],
        })
        .mockReturnValueOnce({
          score: -3,
          comparative: -1.5, // -30
          positive: [],
          negative: ['bad'],
        });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.overallScore).toBe(10); // (50 + -30) / 2 = 10
    });
  });

  describe('overall direction calculation', () => {
    it('should return positive for overall score > 0', async () => {
      mockAnalyze.mockReturnValue({
        score: 5,
        comparative: 1.0,
        positive: ['good'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'good' });

      expect(result.overallDirection).toBe('positive');
    });

    it('should return negative for overall score < 0', async () => {
      mockAnalyze.mockReturnValue({
        score: -5,
        comparative: -1.0,
        positive: [],
        negative: ['bad'],
      });

      const result = await service.getSentiment({ text: 'bad' });

      expect(result.overallDirection).toBe('negative');
    });

    it('should return neutral for overall score = 0', async () => {
      mockAnalyze.mockReturnValue({
        score: 0,
        comparative: 0,
        positive: [],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'neutral' });

      expect(result.overallDirection).toBe('neutral');
    });
  });

  describe('confidence calculation', () => {
    it('should return high confidence for agreement >= 75% and intensity > 3', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'Great',
            publisher: 'R',
            link: 'https://a.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Excellent',
            publisher: 'R',
            link: 'https://b.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Amazing',
            publisher: 'R',
            link: 'https://c.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Wonderful',
            publisher: 'R',
            link: 'https://d.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
        ],
        totalCount: 4,
        timestamp: '2024-01-15T10:00:00Z',
      });

      mockAnalyze.mockReturnValue({
        score: 4,
        comparative: 4.0, // High intensity
        positive: ['great'],
        negative: [],
      });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.confidence).toBe('high');
    });

    it('should return medium confidence for agreement >= 50% and intensity > 1', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'Good',
            publisher: 'R',
            link: 'https://a.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Bad',
            publisher: 'R',
            link: 'https://b.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
        ],
        totalCount: 2,
        timestamp: '2024-01-15T10:00:00Z',
      });

      mockAnalyze
        .mockReturnValueOnce({
          score: 2,
          comparative: 2.0,
          positive: ['good'],
          negative: [],
        })
        .mockReturnValueOnce({
          score: 1,
          comparative: 1.5,
          positive: ['ok'],
          negative: [],
        });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.confidence).toBe('medium');
    });

    it('should return low confidence for mixed signals', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'Good',
            publisher: 'R',
            link: 'https://a.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'Bad',
            publisher: 'R',
            link: 'https://b.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
        ],
        totalCount: 2,
        timestamp: '2024-01-15T10:00:00Z',
      });

      mockAnalyze
        .mockReturnValueOnce({
          score: 2,
          comparative: 0.5,
          positive: ['good'],
          negative: [],
        })
        .mockReturnValueOnce({
          score: -2,
          comparative: -0.5,
          positive: [],
          negative: ['bad'],
        });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.confidence).toBe('low');
    });

    it('should return low confidence for single text analysis', async () => {
      mockAnalyze.mockReturnValue({
        score: 5,
        comparative: 1.0,
        positive: ['good'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'good' });

      expect(result.confidence).toBe('low');
    });

    it('should return low confidence for empty analysis', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [],
        totalCount: 0,
        timestamp: '2024-01-15T10:00:00Z',
      });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.confidence).toBe('low');
    });
  });

  describe('summary generation', () => {
    it('should generate summary for positive sentiment', async () => {
      mockAnalyze.mockReturnValue({
        score: 5,
        comparative: 2.5,
        positive: ['great', 'excellent'],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'great excellent' });

      expect(result.summary).toContain('positive');
    });

    it('should generate summary for negative sentiment', async () => {
      mockAnalyze.mockReturnValue({
        score: -5,
        comparative: -2.5,
        positive: [],
        negative: ['bad', 'terrible'],
      });

      const result = await service.getSentiment({ text: 'bad terrible' });

      expect(result.summary).toContain('negative');
    });

    it('should generate summary for neutral sentiment', async () => {
      mockAnalyze.mockReturnValue({
        score: 0,
        comparative: 0,
        positive: [],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'neutral' });

      expect(result.summary).toContain('neutral');
    });

    it('should include article count for ISIN analysis', async () => {
      mockNewsService.getNews.mockResolvedValue({
        isin: 'US0378331005',
        symbol: 'AAPL',
        articles: [
          {
            title: 'News 1',
            publisher: 'R',
            link: 'https://a.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
          {
            title: 'News 2',
            publisher: 'R',
            link: 'https://b.com',
            publishedAt: '2024-01-15T10:00:00Z',
          },
        ],
        totalCount: 2,
        timestamp: '2024-01-15T10:00:00Z',
      });

      mockAnalyze.mockReturnValue({
        score: 2,
        comparative: 0.5,
        positive: ['good'],
        negative: [],
      });

      const result = await service.getSentiment({ isin: 'US0378331005' });

      expect(result.summary).toContain('2');
      expect(result.summary).toContain('article');
    });
  });

  describe('timestamp', () => {
    it('should include timestamp in response', async () => {
      mockAnalyze.mockReturnValue({
        score: 0,
        comparative: 0,
        positive: [],
        negative: [],
      });

      const result = await service.getSentiment({ text: 'test' });

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should handle non-Error thrown from newsService', async () => {
      mockNewsService.getNews.mockRejectedValue('String error');

      await expect(
        service.getSentiment({ isin: 'US0378331005' }),
      ).rejects.toThrow('Failed to get sentiment: String error');
    });
  });

  describe('GetSentimentRequestSchema', () => {
    it('should accept request with isin', () => {
      const result = GetSentimentRequestSchema.safeParse({
        isin: 'US0378331005',
      });
      expect(result.success).toBe(true);
    });

    it('should accept request with text', () => {
      const result = GetSentimentRequestSchema.safeParse({
        text: 'Great news about the market',
      });
      expect(result.success).toBe(true);
    });

    it('should accept request with both isin and text', () => {
      const result = GetSentimentRequestSchema.safeParse({
        isin: 'US0378331005',
        text: 'Great news',
      });
      expect(result.success).toBe(true);
    });

    it('should reject request with neither isin nor text', () => {
      const result = GetSentimentRequestSchema.safeParse({});
      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].message).toBe(
        'Either isin or text must be provided',
      );
    });

    it('should accept request with newsLimit', () => {
      const result = GetSentimentRequestSchema.safeParse({
        isin: 'US0378331005',
        newsLimit: 10,
      });
      expect(result.success).toBe(true);
      expect(result.success && result.data.newsLimit).toBe(10);
    });

    it('should allow undefined newsLimit (service uses default of 5)', () => {
      const result = GetSentimentRequestSchema.safeParse({
        isin: 'US0378331005',
      });
      expect(result.success).toBe(true);
      // newsLimit is optional, so undefined is valid
      // The service handles the default value of 5
      expect(result.success && result.data.newsLimit).toBeUndefined();
    });
  });
});
