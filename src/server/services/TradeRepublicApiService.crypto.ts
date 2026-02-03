/**
 * Trade Republic API Service - CryptoManager
 *
 * Handles ECDSA key generation, storage, and signing for authentication.
 */

import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { logger } from '../../logger';
import {
  KEY_FILE_NAME,
  type KeyPair,
  type SignedPayload,
} from './TradeRepublicApiService.types';

/**
 * Manages ECDSA key pairs for Trade Republic authentication.
 *
 * - Generates NIST P-256 key pairs
 * - Stores/loads keys from file system
 * - Signs messages with SHA-512
 * - Creates signed payloads with timestamps
 */
export class CryptoManager {
  private readonly keyFilePath: string;

  constructor(private readonly baseDir: string) {
    this.keyFilePath = path.join(baseDir, KEY_FILE_NAME);
  }

  /**
   * Generates a new ECDSA P-256 key pair.
   */
  public async generateKeyPair(): Promise<KeyPair> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'ec',
        {
          namedCurve: 'prime256v1',
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        },
        (err, publicKeyPem, privateKeyPem) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ privateKeyPem, publicKeyPem });
        },
      );
    });
  }

  /**
   * Saves a key pair to the file system.
   */
  public async saveKeyPair(keyPair: KeyPair): Promise<void> {
    logger.api.info(`Saving key pair to ${this.keyFilePath}`);
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.keyFilePath, JSON.stringify(keyPair, null, 2));
  }

  /**
   * Loads a key pair from the file system.
   * Returns null if no key pair exists.
   */
  public async loadKeyPair(): Promise<KeyPair | null> {
    const exists = await this.hasStoredKeyPair();
    if (!exists) {
      return null;
    }
    logger.api.info(`Loading key pair from ${this.keyFilePath}`);
    const data = await fs.readFile(this.keyFilePath, 'utf-8');
    return JSON.parse(data) as KeyPair;
  }

  /**
   * Checks if a stored key pair exists.
   */
  public async hasStoredKeyPair(): Promise<boolean> {
    try {
      await fs.access(this.keyFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Signs a message using ECDSA with SHA-512.
   * Returns a base64-encoded signature.
   */
  public sign(message: string, privateKeyPem: string): string {
    const sign = crypto.createSign('SHA512');
    sign.update(message);
    sign.end();
    const signature = sign.sign(privateKeyPem);
    return signature.toString('base64');
  }

  /**
   * Creates a signed payload with timestamp and signature.
   */
  public createSignedPayload(
    data: object,
    privateKeyPem: string,
  ): SignedPayload {
    const timestamp = new Date().toISOString();
    const dataToSign = JSON.stringify({ timestamp, data });
    const signature = this.sign(dataToSign, privateKeyPem);
    return { timestamp, data, signature };
  }

  /**
   * Exports the raw public key as base64.
   * Returns the uncompressed EC point (65 bytes for P-256).
   */
  public getPublicKeyBase64(publicKeyPem: string): string {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const rawKey = publicKey.export({ type: 'spki', format: 'der' });
    // SPKI format for EC key: 26 byte header + 65 byte public key point
    // Extract the last 65 bytes (the uncompressed public key point)
    const rawKeyBuffer = Buffer.from(rawKey);
    const publicKeyBytes = rawKeyBuffer.subarray(rawKeyBuffer.length - 65);
    return publicKeyBytes.toString('base64');
  }
}
