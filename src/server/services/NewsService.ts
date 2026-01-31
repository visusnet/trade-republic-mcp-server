/**
 * News Service
 *
 * Fetches news articles for instruments using Yahoo Finance.
 */

import yahooFinance from 'yahoo-finance2';

import { logger } from '../../logger';
import type { SymbolMapper } from './SymbolMapper';
import type { GetNewsRequest } from './NewsService.request';
import type { GetNewsResponse, NewsArticle } from './NewsService.response';
import {
  NewsServiceError,
  type YahooFinanceSearchWithNewsFn,
} from './NewsService.types';

const DEFAULT_NEWS_LIMIT = 10;

/**
 * Default implementation using yahoo-finance2.
 */
/* istanbul ignore next -- @preserve Untestable without network calls */
function createDefaultSearchWithNews(): YahooFinanceSearchWithNewsFn {
  return (query: string, options: { newsCount: number }) =>
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    yahooFinance.search(query, options);
}

/**
 * Dependencies for NewsService.
 */
export interface NewsServiceDependencies {
  symbolMapper: SymbolMapper;
  searchWithNewsFn?: YahooFinanceSearchWithNewsFn;
}

/**
 * Service for fetching news articles.
 */
export class NewsService {
  private readonly symbolMapper: SymbolMapper;
  private readonly searchWithNewsFn: YahooFinanceSearchWithNewsFn;

  constructor(deps: NewsServiceDependencies) {
    this.symbolMapper = deps.symbolMapper;
    this.searchWithNewsFn =
      deps.searchWithNewsFn ?? createDefaultSearchWithNews();
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
    let newsData: Awaited<ReturnType<YahooFinanceSearchWithNewsFn>>;

    try {
      symbol = await this.symbolMapper.isinToSymbol(request.isin);
      newsData = await this.searchWithNewsFn(symbol, { newsCount: limit });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new NewsServiceError(`Failed to get news: ${message}`);
    }

    const articles: NewsArticle[] = newsData.news.map((item) => ({
      title: item.title,
      publisher: item.publisher,
      link: item.link,
      publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
      thumbnail: item.thumbnail?.resolutions[0]?.url,
    }));

    logger.api.debug(
      { isin: request.isin, symbol, count: articles.length },
      'Fetched news articles',
    );

    return {
      isin: request.isin,
      symbol,
      articles,
      totalCount: articles.length,
      timestamp: new Date().toISOString(),
    };
  }
}
