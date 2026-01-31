/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';

import { mockLogger } from '@test/loggerMock';
import {
  ConnectionStatus,
  MESSAGE_CODE,
  type WebSocket,
  type WebSocketFactory,
  type WebSocketMessage,
} from './TradeRepublicApiService.types';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { WebSocketManager } from './TradeRepublicApiService.websocket';

/** Extended mock interface for testing with mutable readyState */
interface MockWebSocket extends WebSocket {
  _readyState: number;
  setReadyState(state: number): void;
  emit: (event: string, ...args: unknown[]) => boolean;
}

/**
 * Creates a mock WebSocket for testing
 */
function createMockWebSocket(): MockWebSocket {
  const emitter = new EventEmitter();
  let readyStateValue = 0;

  const mockWs: MockWebSocket = {
    _readyState: 0,
    get readyState(): number {
      return readyStateValue;
    },
    setReadyState(state: number): void {
      readyStateValue = state;
      mockWs._readyState = state;
    },
    OPEN: 1,
    CLOSED: 3,
    CONNECTING: 0,
    CLOSING: 2,
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
      return mockWs;
    }) as unknown as MockWebSocket['on'],
    removeAllListeners: jest.fn(() => {
      emitter.removeAllListeners();
      return mockWs;
    }) as unknown as MockWebSocket['removeAllListeners'],
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
  };

  return mockWs;
}

describe('WebSocketManager', () => {
  let mockWs: MockWebSocket;
  let mockWsFactory: WebSocketFactory;
  let wsManager: WebSocketManager;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    mockWsFactory = jest.fn(() => mockWs as unknown as WebSocket);
    wsManager = new WebSocketManager(mockWsFactory);
  });

  describe('connect', () => {
    it('should establish a WebSocket connection', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      // Simulate connection open
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');

      await connectPromise;

      expect(mockWsFactory).toHaveBeenCalled();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });

    it('should send connection message with session token', async () => {
      const sessionToken = 'test-session-token';
      const connectPromise = wsManager.connect(sessionToken);

      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');

      await connectPromise;

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('connect 31'),
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(sessionToken),
      );
    });

    it('should reject if connection fails', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      mockWs.emit('error', new Error('Connection failed'));

      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should reject if connection closes unexpectedly', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      mockWs.emit('close', 1006, Buffer.from('Abnormal closure'));

      await expect(connectPromise).rejects.toThrow();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should log connection status', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');

      await connectPromise;

      expect(logger.api.info).toHaveBeenCalledWith(
        expect.stringContaining('Connecting'),
      );
    });
  });

  describe('disconnect', () => {
    it('should close the WebSocket connection', async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;

      wsManager.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should remove all listeners on disconnect', async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;

      wsManager.disconnect();

      expect(mockWs.removeAllListeners).toHaveBeenCalled();
    });

    it('should be safe to call disconnect when not connected', () => {
      expect(() => {
        wsManager.disconnect();
      }).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return DISCONNECTED initially', () => {
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should return CONNECTING during connection', () => {
      void wsManager.connect('test-session-token');
      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTING);
    });

    it('should return CONNECTED after successful connection', async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;

      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;
    });

    it('should send subscription message and return subscription ID', () => {
      const subId = wsManager.subscribe('ticker', { isin: 'DE0007164600' });

      expect(typeof subId).toBe('number');
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(`sub ${subId}`),
      );
    });

    it('should increment subscription IDs', () => {
      const subId1 = wsManager.subscribe('ticker');
      const subId2 = wsManager.subscribe('portfolio');

      expect(subId2).toBe(subId1 + 1);
    });

    it('should include topic in subscription message', () => {
      wsManager.subscribe('timeline');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"timeline"'),
      );
    });

    it('should include payload in subscription message', () => {
      wsManager.subscribe('instrument', { isin: 'DE0007164600' });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"isin":"DE0007164600"'),
      );
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;
    });

    it('should send unsubscribe message', () => {
      const subId = wsManager.subscribe('ticker');
      wsManager.unsubscribe(subId);

      expect(mockWs.send).toHaveBeenCalledWith(`unsub ${subId}`);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;
    });

    it('should parse and emit Answer messages', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      mockWs.emit('message', Buffer.from(`${subId} A {"price":100.50}`));

      expect(handler).toHaveBeenCalledWith({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { price: 100.5 },
      } satisfies WebSocketMessage);
    });

    it('should parse and emit Delta messages', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      mockWs.emit('message', Buffer.from(`${subId} D {"price":101.00}`));

      expect(handler).toHaveBeenCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { price: 101.0 },
      } satisfies WebSocketMessage);
    });

    it('should parse and emit Complete messages', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('timeline');
      mockWs.emit('message', Buffer.from(`${subId} C {}`));

      expect(handler).toHaveBeenCalledWith({
        id: subId,
        code: MESSAGE_CODE.C,
        payload: {},
      } satisfies WebSocketMessage);
    });

    it('should handle string messages directly', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Send as string instead of Buffer
      mockWs.emit('message', `${subId} A {"price":50.00}`);

      expect(handler).toHaveBeenCalledWith({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { price: 50.0 },
      } satisfies WebSocketMessage);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;
    });

    it('should emit error for Error code messages', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      const subId = wsManager.subscribe('invalid');
      mockWs.emit(
        'message',
        Buffer.from(`${subId} E {"message":"Unknown topic"}`),
      );

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: subId,
          code: MESSAGE_CODE.E,
        }),
      );
    });

    it('should emit error for WebSocket errors', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      const error = new Error('Network error');
      mockWs.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should handle malformed messages gracefully', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      mockWs.emit('message', Buffer.from('not a valid message'));

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle messages with invalid JSON', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      // Valid format but invalid JSON payload
      mockWs.emit('message', Buffer.from('1 A {invalid json}'));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('connection errors', () => {
    it('should throw if already connecting', async () => {
      // Start connecting
      void wsManager.connect('test-session-token');

      // Try to connect again
      await expect(wsManager.connect('test-session-token')).rejects.toThrow(
        'Already connected',
      );
    });

    it('should throw if already connected', async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      mockWs.emit('open');
      await connectPromise;

      // Try to connect again
      await expect(wsManager.connect('test-session-token')).rejects.toThrow(
        'Already connected',
      );
    });
  });

  describe('subscription errors', () => {
    it('should throw if subscribe when not connected', () => {
      expect(() => wsManager.subscribe('ticker')).toThrow('Not connected');
    });

    it('should throw if unsubscribe when not connected', () => {
      expect(() => {
        wsManager.unsubscribe(1);
      }).toThrow('Not connected');
    });
  });
});
