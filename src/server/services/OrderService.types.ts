/**
 * Order Service - Types and Error Classes
 */

// =============================================================================
// Error Classes
// =============================================================================

/** Base error class for Order Service errors */
export class OrderServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'OrderServiceError';
  }
}

/** Order validation errors */
export class OrderValidationError extends OrderServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'OrderValidationError';
  }
}

/** Insufficient funds errors */
export class InsufficientFundsError extends OrderServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'InsufficientFundsError';
  }
}

/** Order not found errors */
export class OrderNotFoundError extends OrderServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'OrderNotFoundError';
  }
}

/** Order not modifiable errors */
export class OrderNotModifiableError extends OrderServiceError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'OrderNotModifiableError';
  }
}
