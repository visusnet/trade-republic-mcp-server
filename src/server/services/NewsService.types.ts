/**
 * News Service - Types and Errors
 */

/**
 * Error class for news service operations.
 */
export class NewsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsServiceError';
  }
}

/**
 * Interface for Yahoo Finance search function that returns news.
 */
export interface YahooFinanceSearchWithNewsFn {
  (
    query: string,
    options: { newsCount: number },
  ): Promise<{
    news: Array<{
      title: string;
      publisher: string;
      link: string;
      providerPublishTime: number;
      thumbnail?: { resolutions: Array<{ url: string }> };
    }>;
  }>;
}
