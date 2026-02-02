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
