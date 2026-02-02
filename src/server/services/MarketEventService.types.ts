/**
 * Market Event Service - Types, Enums, and Error Classes
 */

// =============================================================================
// Enums
// =============================================================================

/**
 * Ticker fields that can be monitored for conditions.
 */
export enum ConditionField {
  BID = 'bid',
  ASK = 'ask',
  MID = 'mid',
  LAST = 'last',
  SPREAD = 'spread',
  SPREAD_PERCENT = 'spreadPercent',
}

/**
 * Comparison operators for condition evaluation.
 *
 * Note: crossAbove/crossBelow require a previous ticker value to detect crossing.
 * They cannot trigger on the first ticker received after subscription.
 */
export enum ConditionOperator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  CROSS_ABOVE = 'crossAbove',
  CROSS_BELOW = 'crossBelow',
}

/**
 * Logic for combining multiple conditions.
 */
export enum ConditionLogic {
  ANY = 'any',
  ALL = 'all',
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error class for Market Event Service errors.
 */
export class MarketEventError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'MarketEventError';
  }
}
