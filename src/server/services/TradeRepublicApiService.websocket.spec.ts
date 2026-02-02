/* eslint-disable @typescript-eslint/unbound-method */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { EventEmitter } from 'events';

import { mockLogger } from '@test/loggerMock';
import {
  ConnectionStatus,
  MESSAGE_CODE,
  type WebSocket,
  type WebSocketCloseEvent,
  type WebSocketErrorEvent,
  type WebSocketMessage,
  type WebSocketMessageEvent,
  type WebSocketOpenEvent,
  type WebSocketOptions,
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
  emit: (event: string, eventData?: unknown) => boolean;
}

/**
 * Creates a mock WebSocket for testing with addEventListener API
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
    addEventListener: jest.fn(
      (event: string, listener: (event: unknown) => void) => {
        emitter.on(event, listener);
      },
    ) as unknown as MockWebSocket['addEventListener'],
    removeEventListener: jest.fn(
      (event: string, listener: (...args: unknown[]) => void) => {
        emitter.off(event, listener);
      },
    ) as unknown as MockWebSocket['removeEventListener'],
    emit: (event: string, eventData?: unknown) =>
      emitter.emit(event, eventData),
  };

  return mockWs;
}

/**
 * Helper to emit a message event in the new format
 */
function emitMessage(mockWs: MockWebSocket, data: string | Buffer): boolean {
  const event: WebSocketMessageEvent = { type: 'message', data };
  return mockWs.emit('message', event);
}

/**
 * Helper to emit an open event
 */
function emitOpen(mockWs: MockWebSocket): boolean {
  const event: WebSocketOpenEvent = { type: 'open' };
  return mockWs.emit('open', event);
}

/**
 * Helper to emit a close event
 */
function emitClose(
  mockWs: MockWebSocket,
  code: number,
  reason: string,
): boolean {
  const event: WebSocketCloseEvent = { type: 'close', code, reason };
  return mockWs.emit('close', event);
}

/**
 * Helper to emit an error event
 */
function emitError(mockWs: MockWebSocket, error: Error): boolean {
  const event: WebSocketErrorEvent = {
    type: 'error',
    error,
    message: error.message,
  };
  return mockWs.emit('error', event);
}

describe('WebSocketManager', () => {
  let mockWs: MockWebSocket;
  let mockWsFactory: jest.Mock<
    (url: string, options?: WebSocketOptions) => WebSocket
  >;
  let wsManager: WebSocketManager;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    mockWsFactory = jest.fn(
      (_url: string, _options?: WebSocketOptions) =>
        mockWs as unknown as WebSocket,
    );
    wsManager = new WebSocketManager(mockWsFactory);
  });

  afterEach(() => {
    // Clean up any pending timers
    wsManager.disconnect();
  });

  describe('connect', () => {
    it('should establish a WebSocket connection', async () => {
      const connectPromise = wsManager.connect('session=test-cookie');

      // Simulate connection open
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);

      await connectPromise;

      expect(mockWsFactory).toHaveBeenCalled();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });

    it('should pass cookie header to WebSocket factory', async () => {
      const cookieHeader = 'session=test-cookie; other=value';
      const connectPromise = wsManager.connect(cookieHeader);

      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);

      await connectPromise;

      expect(mockWsFactory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Cookie: cookieHeader },
        }),
      );
    });

    it('should pass empty options when cookie header is empty', async () => {
      const connectPromise = wsManager.connect('');

      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);

      await connectPromise;

      expect(mockWsFactory).toHaveBeenCalledWith(expect.any(String), {});
    });

    it('should send connection message without sessionToken', async () => {
      const connectPromise = wsManager.connect('session=test-cookie');

      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);

      await connectPromise;

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('connect 31'),
      );
      // Verify sessionToken is NOT in the connect message
      const sendCalls = (mockWs.send as jest.Mock).mock.calls as string[][];
      const connectMessage = sendCalls
        .map((call) => call[0])
        .find((msg) => msg.includes('connect 31'));
      expect(connectMessage).toBeDefined();
      expect(connectMessage).not.toContain('sessionToken');
    });

    it('should reject if connection fails', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      emitError(mockWs, new Error('Connection failed'));

      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should reject with message when error event has no error object during connect', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      // Emit error event with message but no error object during connecting
      const event: WebSocketErrorEvent = {
        type: 'error',
        message: 'Connection reset by peer',
      };
      mockWs.emit('error', event);

      await expect(connectPromise).rejects.toThrow('Connection reset by peer');
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should reject if connection closes unexpectedly', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      emitClose(mockWs, 1006, 'Abnormal closure');

      await expect(connectPromise).rejects.toThrow();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should log connection status', async () => {
      const connectPromise = wsManager.connect('test-session-token');

      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);

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
      emitOpen(mockWs);
      await connectPromise;

      wsManager.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should remove event listeners on disconnect', async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      wsManager.disconnect();

      expect(mockWs.removeEventListener).toHaveBeenCalledWith(
        'open',
        expect.any(Function),
      );
      expect(mockWs.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
      expect(mockWs.removeEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockWs.removeEventListener).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );
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
      emitOpen(mockWs);
      await connectPromise;

      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
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
      emitOpen(mockWs);
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
      emitOpen(mockWs);
      await connectPromise;
    });

    it('should parse and emit Answer messages', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100.50}`));

      expect(handler).toHaveBeenCalledWith({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { price: 100.5 },
      } satisfies WebSocketMessage);
    });

    it('should parse and emit Delta messages with proper decoding', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // First send Answer to establish previous response
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Then send Delta: =10 copies "{"price":1", +01} inserts "01}"
      // Result: {"price":101}
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+01}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { price: 101 },
      } satisfies WebSocketMessage);
    });

    it('should parse and emit Complete messages', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('timeline');
      emitMessage(mockWs, Buffer.from(`${subId} C {}`));

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
      emitMessage(mockWs, `${subId} A {"price":50.00}`);

      expect(handler).toHaveBeenCalledWith({
        id: subId,
        code: MESSAGE_CODE.A,
        payload: { price: 50.0 },
      } satisfies WebSocketMessage);
    });
  });

  describe('delta message decoding', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;
    });

    it('should decode delta with = (copy) instruction', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // First send an Answer message to establish previous response
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Then send a Delta message with copy instruction: copy first 10 chars + insert new ending
      // Previous: {"price":100}
      // Delta: =10 means copy "{"price":1" + then append via +
      // =10 copies first 10 chars: {"price":1
      // +50} inserts "50}"
      // Result: {"price":150}
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+50}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { price: 150 },
      } satisfies WebSocketMessage);
    });

    it('should decode delta with + (insert) instruction', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // First establish previous response
      emitMessage(mockWs, Buffer.from(`${subId} A {"a":1}`));

      // Delta: =5 copies {"a": then +2} inserts 2}
      // Result: {"a":2}
      emitMessage(mockWs, Buffer.from(`${subId} D =5\t+2}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { a: 2 },
      } satisfies WebSocketMessage);
    });

    it('should decode delta with - (skip) instruction', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Previous: {"price":100,"old":true}
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100,"old":true}`));

      // Delta: =13 copies {"price":100, then -11 skips "old":true, then +} to close
      // =13 copies: {"price":100,
      // -11 skips: "old":true
      // +"new":false} inserts: "new":false}
      // Result: {"price":100,"new":false}
      emitMessage(mockWs, Buffer.from(`${subId} D =13\t-11\t+"new":false}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { price: 100, new: false },
      } satisfies WebSocketMessage);
    });

    it('should decode delta with mixed instructions', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('data');
      // Previous: {"foo":"bar","baz":123}
      // Chars:     0123456789012345678901234
      //            {"foo":"bar","baz":123}
      // Length: 23 chars
      emitMessage(mockWs, Buffer.from(`${subId} A {"foo":"bar","baz":123}`));

      // Mixed delta: copy 13, skip 3, insert new text, copy rest
      // =13 copies positions 0-12: {"foo":"bar",
      // -3 skips positions 13-15: "ba
      // +qux inserts: qux
      // =7 copies positions 16-22: z":123}
      // Result: {"foo":"bar",quxz":123}  -- that's not valid JSON

      // Let's do a simpler, correct example:
      // Previous: {"a":1,"b":2}
      // Chars:     0123456789012
      // Length: 13 chars
      emitMessage(mockWs, Buffer.from(`${subId} A {"a":1,"b":2}`));

      // Delta to change "b":2 to "c":3
      // =6 copies positions 0-5: {"a":1
      // -5 skips positions 6-10: ,"b":
      // +,"c": inserts: ,"c":
      // =2 copies positions 11-12: 2} - wait we want 3}
      // Actually let's do:
      // =6 copies: {"a":1
      // -6 skips: ,"b":2
      // +,"c":3} inserts the new ending
      // Result: {"a":1,"c":3}
      emitMessage(mockWs, Buffer.from(`${subId} D =6\t-6\t+,"c":3}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { a: 1, c: 3 },
      } satisfies WebSocketMessage);
    });

    it('should decode URL-encoded characters in + instruction', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Previous: {"text":"hi"}
      emitMessage(mockWs, Buffer.from(`${subId} A {"text":"hi"}`));

      // Delta inserts URL-encoded content
      // =9 copies: {"text":"
      // +hello%20world"} inserts: hello world"} (URL decoded, %20 -> space)
      emitMessage(mockWs, Buffer.from(`${subId} D =9\t+hello%20world"}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { text: 'hello world' },
      } satisfies WebSocketMessage);
    });

    it('should decode + as space in URL-decoded content', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Previous: {"text":"hi"}
      emitMessage(mockWs, Buffer.from(`${subId} A {"text":"hi"}`));

      // + signs in content become spaces (URL encoding)
      // =9 copies: {"text":"
      // +hello+world"} inserts: hello world"} (+ -> space)
      emitMessage(mockWs, Buffer.from(`${subId} D =9\t+hello+world"}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { text: 'hello world' },
      } satisfies WebSocketMessage);
    });

    it('should throw error for delta without previous response', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      const subId = wsManager.subscribe('ticker');
      // Send delta message without a previous Answer
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+new}`));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('No previous response'),
        }),
      );
    });

    it('should silently skip unknown instruction types', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Previous: {"a":1}
      emitMessage(mockWs, Buffer.from(`${subId} A {"a":1}`));

      // Delta with unknown instruction 'X5' should be skipped
      // =5 copies: {"a":
      // X5 is unknown, skip it
      // +2} inserts: 2}
      emitMessage(mockWs, Buffer.from(`${subId} D =5\t*unknown\t+2}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { a: 2 },
      } satisfies WebSocketMessage);
    });

    it('should clean up previousResponses on Complete message', () => {
      const handler = jest.fn();
      const errorHandler = jest.fn();
      wsManager.on('message', handler);
      wsManager.on('error', errorHandler);

      const subId = wsManager.subscribe('ticker');
      // Establish previous response
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Send complete message to clean up
      emitMessage(mockWs, Buffer.from(`${subId} C {}`));

      // Now try to send delta - should fail because previous was cleaned up
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+50}`));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('No previous response'),
        }),
      );
    });

    it('should store Answer message for future deltas', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Send Answer - should be stored
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Send Delta - should work because Answer was stored
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+50}`));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { price: 150 },
      } satisfies WebSocketMessage);
    });

    it('should store Delta result for subsequent deltas', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Send Answer: {"price":100}
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Send Delta to change to {"price":150}
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+50}`));

      // Send another Delta based on {"price":150} -> {"price":200}
      // Previous: {"price":150}
      // =10 copies: {"price":1
      // -1 skips: 5
      // +00} inserts: 00}
      // Result: {"price":100} - wait that's wrong
      // Let me recalculate:
      // Previous: {"price":150} - 13 chars
      // =10 copies: {"price":1
      // +00} inserts: 00}
      // Result: {"price":100}
      // Actually let's do a simpler test:
      // Previous: {"price":150}
      // =10 copies: {"price":1
      // -1 skips: 5
      // +99} inserts: 99}
      // Result: {"price":199}
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t-1\t+99}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { price: 199 },
      } satisfies WebSocketMessage);
    });

    it('should handle empty diff segments gracefully', () => {
      const handler = jest.fn();
      wsManager.on('message', handler);

      const subId = wsManager.subscribe('ticker');
      // Previous: {"a":1}
      emitMessage(mockWs, Buffer.from(`${subId} A {"a":1}`));

      // Delta with empty segments (double tabs)
      emitMessage(mockWs, Buffer.from(`${subId} D =5\t\t+2}`));

      expect(handler).toHaveBeenLastCalledWith({
        id: subId,
        code: MESSAGE_CODE.D,
        payload: { a: 2 },
      } satisfies WebSocketMessage);
    });
  });

  describe('disconnect clears previousResponses', () => {
    it('should clear all previousResponses on disconnect', async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      const subId = wsManager.subscribe('ticker');
      // Establish previous response
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Disconnect
      wsManager.disconnect();

      // Reconnect
      mockWs = createMockWebSocket();
      mockWsFactory = jest.fn(() => mockWs as unknown as WebSocket);
      wsManager = new WebSocketManager(mockWsFactory);
      const reconnectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await reconnectPromise;

      wsManager.on('error', errorHandler);

      // Try to send delta on same subId - should fail because previous was cleared
      emitMessage(mockWs, Buffer.from(`${subId} D =10\t+50}`));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('No previous response'),
        }),
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const connectPromise = wsManager.connect('test-session-token');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;
    });

    it('should emit error for Error code messages', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      const subId = wsManager.subscribe('invalid');
      emitMessage(
        mockWs,
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
      emitError(mockWs, error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should handle error events with message but no error object', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      // Emit error event with message but no error object
      const event: WebSocketErrorEvent = {
        type: 'error',
        message: 'Connection reset',
      };
      mockWs.emit('error', event);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Connection reset',
        }),
      );
    });

    it('should handle error events with neither error nor message', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      // Emit error event with no error or message
      const event: WebSocketErrorEvent = {
        type: 'error',
      };
      mockWs.emit('error', event);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unknown WebSocket error',
        }),
      );
    });

    it('should handle malformed messages gracefully', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      emitMessage(mockWs, Buffer.from('not a valid message'));

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle messages with invalid JSON', () => {
      const errorHandler = jest.fn();
      wsManager.on('error', errorHandler);

      // Valid format but invalid JSON payload
      emitMessage(mockWs, Buffer.from('1 A {invalid json}'));

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
      emitOpen(mockWs);
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

  describe('heartbeat mechanism', () => {
    beforeEach(() => {
      // Fake timers including Date.now() for heartbeat calculations
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should emit error and disconnect after 40s with no messages', async () => {
      const errorHandler = jest.fn();

      const connectPromise = wsManager.connect('test-cookie');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      wsManager.on('error', errorHandler);

      // Advance time by 40 seconds without any messages
      // First check at 20s should pass (only 20s elapsed < 40s timeout)
      await jest.advanceTimersByTimeAsync(20_000);
      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);

      // Second check at 40s should trigger timeout (40s elapsed >= 40s timeout)
      await jest.advanceTimersByTimeAsync(20_000);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Connection timeout'),
        }),
      );
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should reset timeout when message is received', async () => {
      const errorHandler = jest.fn();

      const connectPromise = wsManager.connect('test-cookie');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      wsManager.on('error', errorHandler);

      const subId = wsManager.subscribe('ticker');

      // Advance time by 30 seconds
      await jest.advanceTimersByTimeAsync(30_000);

      // Send a message - this should reset the timeout
      emitMessage(mockWs, Buffer.from(`${subId} A {"price":100}`));

      // Advance another 30 seconds (total 60s, but only 30s since last message)
      await jest.advanceTimersByTimeAsync(30_000);

      // Should NOT have timed out because message reset the timer
      expect(errorHandler).not.toHaveBeenCalled();
      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });

    it('should start heartbeat on connect', async () => {
      const errorHandler = jest.fn();

      const connectPromise = wsManager.connect('test-cookie');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      wsManager.on('error', errorHandler);

      // Heartbeat checks every 20s, timeout is 40s
      // After 20s, first check happens - should still be ok (only 20s elapsed)
      await jest.advanceTimersByTimeAsync(20_000);
      expect(wsManager.getStatus()).toBe(ConnectionStatus.CONNECTED);

      // After another 20s (40s total), timeout should trigger
      await jest.advanceTimersByTimeAsync(20_000);
      expect(wsManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should stop heartbeat on disconnect', async () => {
      const errorHandler = jest.fn();

      const connectPromise = wsManager.connect('test-cookie');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      wsManager.on('error', errorHandler);

      // Disconnect
      wsManager.disconnect();

      // Advance time well past timeout
      await jest.advanceTimersByTimeAsync(60_000);

      // Should NOT emit any error because heartbeat was stopped
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should log warning when connection is considered dead', async () => {
      const errorHandler = jest.fn();

      const connectPromise = wsManager.connect('test-cookie');
      mockWs.setReadyState(mockWs.OPEN);
      emitOpen(mockWs);
      await connectPromise;

      wsManager.on('error', errorHandler);

      // Advance time to exactly timeout (2 heartbeat checks at 20s each)
      await jest.advanceTimersByTimeAsync(40_000);

      expect(logger.api.warn).toHaveBeenCalledWith(
        expect.stringContaining('no message received in 40s'),
      );
    });
  });
});
