/**
 * Trade Republic API Service - Exports and Factory
 *
 * This module exports all service components and provides a factory
 * function for creating the Trade Republic API service with default
 * dependencies.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import WebSocketLib from 'ws';

import { CryptoManager } from './TradeRepublicApiService.crypto';
import { TradeRepublicApiService } from './TradeRepublicApiService';
import {
  DEFAULT_CONFIG_DIR,
  type FileSystem,
} from './TradeRepublicApiService.types';
import { WebSocketManager } from './TradeRepublicApiService.websocket';

// Re-export all types and schemas
export * from './TradeRepublicApiService.types';
export * from './TradeRepublicApiService.request';
export * from './TradeRepublicApiService.response';
export { CryptoManager } from './TradeRepublicApiService.crypto';
export { WebSocketManager } from './TradeRepublicApiService.websocket';
export { TradeRepublicApiService } from './TradeRepublicApiService';

// Portfolio Service exports
export * from './PortfolioService.request';
export * from './PortfolioService.response';
export { PortfolioService } from './PortfolioService';

// Market Data Service exports
export * from './MarketDataService.request';
export * from './MarketDataService.response';
export { MarketDataService } from './MarketDataService';

// Technical Analysis Service exports
export * from './TechnicalAnalysisService.request';
export * from './TechnicalAnalysisService.response';
export { TechnicalAnalysisError } from './TechnicalAnalysisService.types';
export { TechnicalAnalysisService } from './TechnicalAnalysisService';

// Symbol Mapper exports
export { SymbolMapper, SymbolMapperError, IsinSchema } from './SymbolMapper';

// News Service exports
export * from './NewsService.request';
export * from './NewsService.response';
export { NewsServiceError } from './NewsService.types';
export { NewsService } from './NewsService';

// Sentiment Service exports
export * from './SentimentService.request';
export * from './SentimentService.response';
export { SentimentServiceError } from './SentimentService.types';
export { SentimentService } from './SentimentService';

// Fundamentals Service exports
export * from './FundamentalsService.request';
export * from './FundamentalsService.response';
export { FundamentalsServiceError } from './FundamentalsService.types';
export { FundamentalsService } from './FundamentalsService';

// Risk Service exports
export {
  RiskServiceError,
  type CalculatePositionSizeRequest,
  type CalculatePositionSizeResponse,
  type GetRiskMetricsRequest,
  type GetRiskMetricsResponse,
  type VolatilityResult,
  type VaRResult,
  type MaxDrawdownResult,
} from './RiskService.types';
export { RiskService } from './RiskService';

// Order Service exports
export * from './OrderService.request';
export * from './OrderService.response';
export * from './OrderService.types';
export { OrderService } from './OrderService';

/**
 * Default file system implementation using Node.js fs module.
 */
export const defaultFileSystem: FileSystem = {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  },
  async writeFile(filePath: string, data: string): Promise<void> {
    await fs.writeFile(filePath, data, 'utf-8');
  },
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  async mkdir(
    dirPath: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    await fs.mkdir(dirPath, options);
  },
};

/**
 * Default WebSocket factory using the ws library.
 */
export function defaultWebSocketFactory(url: string): WebSocketLib {
  return new WebSocketLib(url);
}

/**
 * Options for creating the Trade Republic API service.
 */
export interface CreateTradeRepublicApiServiceOptions {
  /** Custom config directory. Defaults to ~/.trade-republic-mcp/ */
  configDir?: string;
  /** Custom file system implementation. Defaults to Node.js fs. */
  fileSystem?: FileSystem;
  /** Custom fetch function. Defaults to global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * Creates a TradeRepublicApiService with default dependencies.
 *
 * By default:
 * - Uses ~/.trade-republic-mcp/ for key storage
 * - Uses Node.js fs for file operations
 * - Uses ws library for WebSocket connections
 * - Uses global fetch for HTTP requests
 *
 * @param options - Optional configuration options
 * @returns A configured TradeRepublicApiService instance
 */
export function createTradeRepublicApiService(
  options: CreateTradeRepublicApiServiceOptions = {},
): TradeRepublicApiService {
  const configDir =
    options.configDir ?? path.join(os.homedir(), DEFAULT_CONFIG_DIR);
  const fileSystem = options.fileSystem ?? defaultFileSystem;
  const fetchFn = options.fetchFn ?? fetch;

  const cryptoManager = new CryptoManager(configDir, fileSystem);
  const webSocketManager = new WebSocketManager(defaultWebSocketFactory);

  return new TradeRepublicApiService(cryptoManager, webSocketManager, fetchFn);
}
