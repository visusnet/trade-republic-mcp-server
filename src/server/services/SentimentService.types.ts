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
 * Note: This is defined as an interface rather than a Zod schema because
 * it represents the output of the sentiment library, not data we validate.
 */
export interface SentimentResult {
  /** Raw sentiment score */
  score: number;
  /** Normalized sentiment score per word */
  comparative: number;
  /** List of positive words found */
  positive: string[];
  /** List of negative words found */
  negative: string[];
}
