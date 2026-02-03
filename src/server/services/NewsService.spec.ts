/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

interface YahooNewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  thumbnail?: { resolutions: Array<{ url: string }> };
}

interface YahooSearchResult {
  news: YahooNewsItem[];
}

const mockSearch =
  jest.fn<
    (
      query: string,
      options: { newsCount: number },
    ) => Promise<YahooSearchResult>
  >();

jest.mock('yahoo-finance2', () => {
  const mockYahooFinance = {
    search: (query: string, options: { newsCount: number }) =>
      mockSearch(query, options),
  };
  return {
    __esModule: true,
    default: mockYahooFinance,
  };
});

import { NewsService } from './NewsService';
import { NewsServiceError } from './NewsService.types';
import type { SymbolMapper } from './SymbolMapper';
import type { GetNewsRequest } from './NewsService.request';

describe('NewsService', () => {
  let service: NewsService;
  let mockSymbolMapper: jest.Mocked<SymbolMapper>;

  beforeEach(() => {
    mockSearch.mockReset();

    mockSymbolMapper = {
      isinToSymbol: jest.fn(),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<SymbolMapper>;

    service = new NewsService(mockSymbolMapper);
  });

  describe('getNews', () => {
    const validRequest: GetNewsRequest = {
      isin: 'US0378331005',
      limit: 10,
    };

    it('should return news articles for valid ISIN', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({
        news: [
          {
            title: 'Apple announces new product',
            publisher: 'Reuters',
            link: 'https://example.com/news/1',
            providerPublishTime: 1705312800,
            thumbnail: {
              resolutions: [{ url: 'https://example.com/thumb.jpg' }],
            },
          },
        ],
      });

      const result = await service.getNews(validRequest);

      expect(result.isin).toBe('US0378331005');
      expect(result.symbol).toBe('AAPL');
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe('Apple announces new product');
      expect(result.articles[0].publisher).toBe('Reuters');
      expect(result.articles[0].link).toBe('https://example.com/news/1');
      expect(result.articles[0].thumbnail).toBe(
        'https://example.com/thumb.jpg',
      );
    });

    it('should call symbolMapper with ISIN', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({ news: [] });

      await service.getNews(validRequest);

      expect(mockSymbolMapper.isinToSymbol).toHaveBeenCalledWith(
        'US0378331005',
      );
    });

    it('should call Yahoo Finance search with symbol and news count', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({ news: [] });

      await service.getNews({ isin: 'US0378331005', limit: 15 });

      expect(mockSearch).toHaveBeenCalledWith('AAPL', {
        newsCount: 15,
      });
    });

    it('should use default limit of 10 when not provided', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({ news: [] });

      await service.getNews({ isin: 'US0378331005' });

      expect(mockSearch).toHaveBeenCalledWith('AAPL', {
        newsCount: 10,
      });
    });

    it('should return empty articles array when no news found', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({ news: [] });

      const result = await service.getNews(validRequest);

      expect(result.articles).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle articles without thumbnails', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({
        news: [
          {
            title: 'Apple news',
            publisher: 'Reuters',
            link: 'https://example.com/news/1',
            providerPublishTime: 1705312800,
          },
        ],
      });

      const result = await service.getNews(validRequest);

      expect(result.articles[0].thumbnail).toBeUndefined();
    });

    it('should handle articles with empty thumbnail resolutions', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({
        news: [
          {
            title: 'Apple news',
            publisher: 'Reuters',
            link: 'https://example.com/news/1',
            providerPublishTime: 1705312800,
            thumbnail: { resolutions: [] },
          },
        ],
      });

      const result = await service.getNews(validRequest);

      expect(result.articles[0].thumbnail).toBeUndefined();
    });

    it('should convert providerPublishTime to ISO string', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({
        news: [
          {
            title: 'Apple news',
            publisher: 'Reuters',
            link: 'https://example.com/news/1',
            providerPublishTime: 1705312800,
          },
        ],
      });

      const result = await service.getNews(validRequest);

      expect(result.articles[0].publishedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should throw NewsServiceError when symbolMapper fails', async () => {
      mockSymbolMapper.isinToSymbol.mockRejectedValue(
        new Error('No symbol found'),
      );

      await expect(service.getNews(validRequest)).rejects.toThrow(
        NewsServiceError,
      );
      await expect(service.getNews(validRequest)).rejects.toThrow(
        'Failed to get news: No symbol found',
      );
    });

    it('should throw NewsServiceError when Yahoo Finance search fails', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockRejectedValue(new Error('Network error'));

      await expect(service.getNews(validRequest)).rejects.toThrow(
        NewsServiceError,
      );
      await expect(service.getNews(validRequest)).rejects.toThrow(
        'Failed to get news: Network error',
      );
    });

    it('should handle non-Error thrown from dependencies', async () => {
      mockSymbolMapper.isinToSymbol.mockRejectedValue('String error');

      await expect(service.getNews(validRequest)).rejects.toThrow(
        'Failed to get news: String error',
      );
    });

    it('should include timestamp in response', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({ news: [] });

      const result = await service.getNews(validRequest);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return totalCount matching articles length', async () => {
      mockSymbolMapper.isinToSymbol.mockResolvedValue('AAPL');
      mockSearch.mockResolvedValue({
        news: [
          {
            title: 'News 1',
            publisher: 'Publisher',
            link: 'https://example.com/1',
            providerPublishTime: 1705312800,
          },
          {
            title: 'News 2',
            publisher: 'Publisher',
            link: 'https://example.com/2',
            providerPublishTime: 1705312801,
          },
        ],
      });

      const result = await service.getNews(validRequest);

      expect(result.totalCount).toBe(2);
      expect(result.articles).toHaveLength(2);
    });
  });
});
