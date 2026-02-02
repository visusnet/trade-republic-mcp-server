/**
 * Trade Republic API Service - Exports
 *
 * This module exports all service components.
 */

// Re-export all types and schemas
export * from './TradeRepublicApiService.types';
export * from './TradeRepublicApiService.request';
export * from './TradeRepublicApiService.response';
export { CryptoManager } from './TradeRepublicApiService.crypto';
export { WebSocketManager } from './TradeRepublicApiService.websocket';
export { TradeRepublicApiService } from './TradeRepublicApiService';
export { TradeRepublicCredentials } from './TradeRepublicCredentials';

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

// Market Event Service exports
export * from './MarketEventService.request';
export * from './MarketEventService.response';
export { MarketEventError } from './MarketEventService.types';
export { MarketEventService } from './MarketEventService';
