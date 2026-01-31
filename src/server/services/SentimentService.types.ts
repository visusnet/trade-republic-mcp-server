/**
 * Sentiment Service - Types and Errors
 */

/**
 * Error class for sentiment service operations.
 */
export class SentimentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SentimentServiceError';
  }
}

/**
 * Result from the sentiment npm package.
 */
export interface SentimentResult {
  score: number;
  comparative: number;
  positive: string[];
  negative: string[];
}

/**
 * Interface for sentiment analysis function.
 */
export interface SentimentAnalyzeFn {
  (text: string): SentimentResult;
}
