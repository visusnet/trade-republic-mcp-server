/**
 * News Service
 *
 * Fetches news articles for instruments using Yahoo Finance.
 */

import yahooFinance from 'yahoo-finance2';

import { logger } from '../../logger';
import type { SymbolMapper } from './SymbolMapper';
import type { GetNewsRequest } from './NewsService.request';
import {
  GetNewsResponseSchema,
  type GetNewsResponse,
  type NewsArticle,
} from './NewsService.response';
import { NewsServiceError } from './NewsService.types';

const DEFAULT_NEWS_LIMIT = 10;

/**
 * Yahoo Finance news item structure.
 */
interface YahooNewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  thumbnail?: { resolutions: Array<{ url: string }> };
}

/**
 * Yahoo Finance search result structure (subset for news).
 */
interface YahooSearchResult {
  news: YahooNewsItem[];
}

/**
 * Service for fetching news articles.
 */
export class NewsService {
  private readonly symbolMapper: SymbolMapper;

  constructor(symbolMapper: SymbolMapper) {
    this.symbolMapper = symbolMapper;
  }

  /**
   * Get news articles for an instrument.
   * @param request - The news request
   * @returns News articles for the instrument
   * @throws NewsServiceError if fetching news fails
   */
  public async getNews(request: GetNewsRequest): Promise<GetNewsResponse> {
    const limit = request.limit ?? DEFAULT_NEWS_LIMIT;

    logger.api.info({ isin: request.isin, limit }, 'Fetching news');

    let symbol: string;
    let newsData: YahooSearchResult;

    try {
      symbol = await this.symbolMapper.isinToSymbol(request.isin);
      /* eslint-disable @typescript-eslint/no-deprecated, @typescript-eslint/await-thenable */
      newsData = (await yahooFinance.search(symbol, {
        newsCount: limit,
      })) as YahooSearchResult;
      /* eslint-enable @typescript-eslint/no-deprecated, @typescript-eslint/await-thenable */
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new NewsServiceError(`Failed to get news: ${message}`);
    }

    const articles: NewsArticle[] = newsData.news.map(
      (item: YahooNewsItem) => ({
        title: item.title,
        publisher: item.publisher,
        link: item.link,
        publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
        thumbnail: item.thumbnail?.resolutions[0]?.url,
      }),
    );

    logger.api.debug(
      { isin: request.isin, symbol, count: articles.length },
      'Fetched news articles',
    );

    return GetNewsResponseSchema.parse({
      isin: request.isin,
      symbol,
      articles,
      totalCount: articles.length,
      timestamp: new Date().toISOString(),
    });
  }
}
