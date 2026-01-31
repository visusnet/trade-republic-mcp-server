/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockLogger } from '@test/loggerMock';
import type { FileSystem, KeyPair } from './TradeRepublicApiService.types';

const logger = mockLogger();
jest.mock('../../logger', () => ({
  logger,
}));

import { CryptoManager } from './TradeRepublicApiService.crypto';

describe('CryptoManager', () => {
  let mockFileSystem: jest.Mocked<FileSystem>;
  let cryptoManager: CryptoManager;

  const testKeyPair: KeyPair = {
    privateKeyPem:
      '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----',
    publicKeyPem:
      '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
  };

  beforeEach(() => {
    mockFileSystem = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      exists: jest.fn(),
      mkdir: jest.fn(),
    };
    cryptoManager = new CryptoManager('/test/config', mockFileSystem);
  });

  describe('generateKeyPair', () => {
    it('should generate a valid ECDSA P-256 key pair', async () => {
      const keyPair = await cryptoManager.generateKeyPair();

      expect(keyPair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
      expect(keyPair.privateKeyPem).toContain('-----END PRIVATE KEY-----');
      expect(keyPair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.publicKeyPem).toContain('-----END PUBLIC KEY-----');
    });

    it('should generate unique key pairs on each call', async () => {
      const keyPair1 = await cryptoManager.generateKeyPair();
      const keyPair2 = await cryptoManager.generateKeyPair();

      expect(keyPair1.privateKeyPem).not.toEqual(keyPair2.privateKeyPem);
      expect(keyPair1.publicKeyPem).not.toEqual(keyPair2.publicKeyPem);
    });
  });

  describe('saveKeyPair', () => {
    it('should save key pair to file system', async () => {
      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);

      await cryptoManager.saveKeyPair(testKeyPair);

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith('/test/config', {
        recursive: true,
      });
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        '/test/config/keys.json',
        JSON.stringify(testKeyPair, null, 2),
      );
    });

    it('should log when saving key pair', async () => {
      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);

      await cryptoManager.saveKeyPair(testKeyPair);

      expect(logger.api.info).toHaveBeenCalledWith(
        'Saving key pair to /test/config/keys.json',
      );
    });
  });

  describe('loadKeyPair', () => {
    it('should load key pair from file system', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(testKeyPair));

      const result = await cryptoManager.loadKeyPair();

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(
        '/test/config/keys.json',
      );
      expect(result).toEqual(testKeyPair);
    });

    it('should return null if key file does not exist', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const result = await cryptoManager.loadKeyPair();

      expect(result).toBeNull();
      expect(mockFileSystem.readFile).not.toHaveBeenCalled();
    });

    it('should log when loading key pair', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(testKeyPair));

      await cryptoManager.loadKeyPair();

      expect(logger.api.info).toHaveBeenCalledWith(
        'Loading key pair from /test/config/keys.json',
      );
    });
  });

  describe('hasStoredKeyPair', () => {
    it('should return true if key file exists', async () => {
      mockFileSystem.exists.mockResolvedValue(true);

      const result = await cryptoManager.hasStoredKeyPair();

      expect(result).toBe(true);
      expect(mockFileSystem.exists).toHaveBeenCalledWith(
        '/test/config/keys.json',
      );
    });

    it('should return false if key file does not exist', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const result = await cryptoManager.hasStoredKeyPair();

      expect(result).toBe(false);
    });
  });

  describe('sign', () => {
    it('should sign a message with the private key', async () => {
      // Generate a real key pair for signing tests
      const realKeyPair = await cryptoManager.generateKeyPair();

      const signature = cryptoManager.sign(
        'test message',
        realKeyPair.privateKeyPem,
      );

      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      // Base64 encoded signature
      expect(Buffer.from(signature, 'base64').toString('base64')).toBe(
        signature,
      );
    });

    it('should produce different signatures for different messages', async () => {
      const realKeyPair = await cryptoManager.generateKeyPair();

      const sig1 = cryptoManager.sign('message1', realKeyPair.privateKeyPem);
      const sig2 = cryptoManager.sign('message2', realKeyPair.privateKeyPem);

      expect(sig1).not.toEqual(sig2);
    });
  });

  describe('createSignedPayload', () => {
    it('should create a signed payload with timestamp and signature', async () => {
      const realKeyPair = await cryptoManager.generateKeyPair();
      const data = { action: 'test' };

      const result = cryptoManager.createSignedPayload(
        data,
        realKeyPair.privateKeyPem,
      );

      expect(result.data).toEqual(data);
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      expect(typeof result.signature).toBe('string');
      expect(result.signature.length).toBeGreaterThan(0);
    });
  });

  describe('getPublicKeyBase64', () => {
    it('should export public key as raw base64', async () => {
      const realKeyPair = await cryptoManager.generateKeyPair();

      const base64Key = cryptoManager.getPublicKeyBase64(
        realKeyPair.publicKeyPem,
      );

      expect(typeof base64Key).toBe('string');
      // Should be valid base64
      expect(Buffer.from(base64Key, 'base64').toString('base64')).toBe(
        base64Key,
      );
      // P-256 uncompressed public key is 65 bytes (0x04 prefix + 32 bytes x + 32 bytes y)
      expect(Buffer.from(base64Key, 'base64').length).toBe(65);
    });
  });
});
