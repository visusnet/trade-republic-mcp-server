/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { mockLogger } from '@test/loggerMock';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { PortfolioService } from './PortfolioService';
import type { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  AuthStatus,
  MESSAGE_CODE,
  TradeRepublicError,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';

/**
 * Creates a mock TradeRepublicApiService for testing.
 */
function createMockApiService(): jest.Mocked<TradeRepublicApiService> {
  return {
    getAuthStatus: jest
      .fn<() => AuthStatus>()
      .mockReturnValue(AuthStatus.AUTHENTICATED),
    subscribe: jest
      .fn<(input: { topic: string; payload?: object }) => number>()
      .mockReturnValue(1),
    unsubscribe: jest.fn<(id: number) => void>(),
    onMessage:
      jest.fn<(handler: (message: WebSocketMessage) => void) => void>(),
    offMessage:
      jest.fn<(handler: (message: WebSocketMessage) => void) => void>(),
    onError:
      jest.fn<(handler: (error: Error | WebSocketMessage) => void) => void>(),
    offError:
      jest.fn<(handler: (error: Error | WebSocketMessage) => void) => void>(),
  } as unknown as jest.Mocked<TradeRepublicApiService>;
}

describe('PortfolioService', () => {
  let mockApi: jest.Mocked<TradeRepublicApiService>;
  let service: PortfolioService;
  const SHORT_TIMEOUT = 100;

  beforeEach(() => {
    mockApi = createMockApiService();
    service = new PortfolioService(mockApi, SHORT_TIMEOUT);
  });

  describe('getPortfolio', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.getPortfolio()).rejects.toThrow(TradeRepublicError);
      await expect(service.getPortfolio()).rejects.toThrow('Not authenticated');
    });

    it('should subscribe to compactPortfolio topic', async () => {
      mockApi.subscribe.mockReturnValue(42);

      // Start the request but don't await it
      const promise = service.getPortfolio();

      // Verify subscription was made
      expect(mockApi.subscribe).toHaveBeenCalledWith({
        topic: 'compactPortfolio',
      });

      // Cleanup - let it timeout
      await expect(promise).rejects.toThrow(
        'compactPortfolio request timed out',
      );
    });

    it('should resolve with validated data on success', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      // Simulate successful response
      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            averageBuyIn: 95,
            realisedProfit: 50,
          },
        ],
        netValue: 1000,
        unrealisedProfit: 50,
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: portfolioData,
      });

      const result = await promise;

      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].instrumentId).toBe('DE0007164600');
      expect(result.positions[0].netSize).toBe(10);
      expect(result.positions[0].averageCost).toBe(95);
      expect(result.netValue).toBe(1000);
    });

    it('should handle netSize as string', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: '10.5',
            netValue: 1050,
            averageBuyIn: 100,
          },
        ],
        netValue: 1050,
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: portfolioData,
      });

      const result = await promise;

      expect(result.positions[0].netSize).toBe(10.5);
    });

    it('should handle unrealisedAverageCost field variation', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            unrealisedAverageCost: 90,
          },
        ],
        netValue: 1000,
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: portfolioData,
      });

      const result = await promise;

      expect(result.positions[0].averageCost).toBe(90);
    });

    it('should reject on API error (code E)', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Subscription failed' },
      });

      await expect(promise).rejects.toThrow(TradeRepublicError);
      await expect(promise).rejects.toThrow('Subscription failed');
    });

    it('should use default error message if no message in error payload', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: {},
      });

      await expect(promise).rejects.toThrow('API error');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(service.getPortfolio()).rejects.toThrow(TradeRepublicError);
      await expect(service.getPortfolio()).rejects.toThrow(
        'compactPortfolio request timed out',
      );
    });

    it('should cleanup (unsubscribe + remove handlers) on success', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      const portfolioData = {
        positions: [],
        netValue: 0,
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: portfolioData,
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should cleanup on error', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Error' },
      });

      await expect(promise).rejects.toThrow();

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should cleanup on timeout', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      await expect(service.getPortfolio()).rejects.toThrow();

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should ignore messages for other subscription IDs', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      // Send message for different subscription ID
      messageHandler!({
        id: 999,
        code: MESSAGE_CODE.A,
        payload: { positions: [], netValue: 0 },
      });

      // Should still timeout since we didn't get our message
      await expect(promise).rejects.toThrow(
        'compactPortfolio request timed out',
      );
    });

    it('should handle WebSocket errors', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPortfolio();

      errorHandler!(new Error('WebSocket connection lost'));

      await expect(promise).rejects.toThrow('WebSocket connection lost');
    });

    it('should handle WebSocketMessage errors with matching subscription ID', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPortfolio();

      errorHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Subscription error' },
      });

      await expect(promise).rejects.toThrow('Subscription error');
    });

    it('should handle WebSocketMessage errors without message in payload', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPortfolio();

      errorHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: 'Raw error string',
      });

      await expect(promise).rejects.toThrow('Raw error string');
    });

    it('should ignore WebSocketMessage errors for other subscription IDs', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPortfolio();

      // Send error for different subscription ID - should be ignored
      errorHandler!({
        id: 999,
        code: MESSAGE_CODE.E,
        payload: { message: 'Other subscription error' },
      });

      // Should still timeout
      await expect(promise).rejects.toThrow(
        'compactPortfolio request timed out',
      );
    });

    it('should reject on subscription failure', async () => {
      mockApi.subscribe.mockImplementation(() => {
        throw new Error('Subscribe failed');
      });

      await expect(service.getPortfolio()).rejects.toThrow('Subscribe failed');
    });

    it('should handle non-Error thrown from subscribe', async () => {
      mockApi.subscribe.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'String error from subscribe';
      });

      await expect(service.getPortfolio()).rejects.toThrow(
        'String error from subscribe',
      );
    });

    it('should ignore errors that arrive after already resolved', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getPortfolio();

      // First send a successful response
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { positions: [], netValue: 0 },
      });

      // Then send an error (which should be ignored)
      errorHandler!(new Error('Late error'));

      // Should resolve successfully without the late error affecting it
      const result = await promise;
      expect(result.netValue).toBe(0);
    });

    it('should handle position with neither averageBuyIn nor unrealisedAverageCost', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      const portfolioData = {
        positions: [
          {
            instrumentId: 'DE0007164600',
            netSize: 10,
            netValue: 1000,
            // No averageBuyIn or unrealisedAverageCost - should default to 0
          },
        ],
        netValue: 1000,
      };

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: portfolioData,
      });

      const result = await promise;

      expect(result.positions[0].averageCost).toBe(0);
    });

    it('should reject on invalid response format', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      // Send invalid data
      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { invalid: 'data' },
      });

      await expect(promise).rejects.toThrow(
        'Invalid compactPortfolio response format',
      );
    });

    it('should ignore unsubscribe errors during cleanup', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);
      mockApi.unsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getPortfolio();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { positions: [], netValue: 0 },
      });

      // Should not throw despite unsubscribe failure
      await expect(promise).resolves.toEqual({
        positions: [],
        netValue: 0,
      });
    });
  });

  describe('getCashBalance', () => {
    it('should throw if not authenticated', async () => {
      mockApi.getAuthStatus.mockReturnValue(AuthStatus.UNAUTHENTICATED);

      await expect(service.getCashBalance()).rejects.toThrow(
        TradeRepublicError,
      );
      await expect(service.getCashBalance()).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('should subscribe to cash topic', async () => {
      mockApi.subscribe.mockReturnValue(42);

      const promise = service.getCashBalance();

      expect(mockApi.subscribe).toHaveBeenCalledWith({ topic: 'cash' });

      await expect(promise).rejects.toThrow('cash request timed out');
    });

    it('should resolve with validated data on success (amount field)', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getCashBalance();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { amount: 1000, currencyId: 'EUR' },
      });

      const result = await promise;

      expect(result.availableCash).toBe(1000);
      expect(result.currency).toBe('EUR');
    });

    it('should handle availableCash field variation', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getCashBalance();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { availableCash: 2000, currency: 'USD' },
      });

      const result = await promise;

      expect(result.availableCash).toBe(2000);
      expect(result.currency).toBe('USD');
    });

    it('should use default values if fields are missing', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getCashBalance();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: {},
      });

      const result = await promise;

      expect(result.availableCash).toBe(0);
      expect(result.currency).toBe('EUR');
    });

    it('should reject on API error (code E)', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getCashBalance();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.E,
        payload: { message: 'Cash subscription failed' },
      });

      await expect(promise).rejects.toThrow('Cash subscription failed');
    });

    it('should reject on timeout', async () => {
      mockApi.subscribe.mockReturnValue(42);

      await expect(service.getCashBalance()).rejects.toThrow(
        'cash request timed out',
      );
    });

    it('should cleanup on success', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let messageHandler: ((message: WebSocketMessage) => void) | undefined;
      mockApi.onMessage.mockImplementation((handler) => {
        messageHandler = handler;
      });

      const promise = service.getCashBalance();

      messageHandler!({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { amount: 100 },
      });

      await promise;

      expect(mockApi.unsubscribe).toHaveBeenCalledWith(subId);
      expect(mockApi.offMessage).toHaveBeenCalled();
      expect(mockApi.offError).toHaveBeenCalled();
    });

    it('should handle WebSocket errors', async () => {
      const subId = 42;
      mockApi.subscribe.mockReturnValue(subId);

      let errorHandler: ((error: Error | WebSocketMessage) => void) | undefined;
      mockApi.onError.mockImplementation((handler) => {
        errorHandler = handler;
      });

      const promise = service.getCashBalance();

      errorHandler!(new Error('Connection lost'));

      await expect(promise).rejects.toThrow('Connection lost');
    });
  });
});
