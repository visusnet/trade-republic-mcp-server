/**
 * Sentiment Service - Response Schemas
 */

import { z } from 'zod';

/**
 * Sentiment direction enum.
 */
export const SentimentDirectionSchema = z.enum([
  'positive',
  'negative',
  'neutral',
]);
export type SentimentDirection = z.output<typeof SentimentDirectionSchema>;

/**
 * Sentiment confidence enum.
 */
export const SentimentConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type SentimentConfidence = z.output<typeof SentimentConfidenceSchema>;

/**
 * Schema for individual text sentiment analysis.
 */
export const TextSentimentSchema = z.object({
  text: z.string(),
  score: z.number(),
  comparative: z.number(),
  direction: SentimentDirectionSchema,
  positiveWords: z.array(z.string()),
  negativeWords: z.array(z.string()),
});
export type TextSentiment = z.output<typeof TextSentimentSchema>;

/**
 * Response schema for get_sentiment tool.
 */
export const GetSentimentResponseSchema = z.object({
  isin: z.string().optional(),
  symbol: z.string().optional(),
  overallScore: z.number().min(-100).max(100),
  overallDirection: SentimentDirectionSchema,
  confidence: SentimentConfidenceSchema,
  analysis: z.array(TextSentimentSchema),
  summary: z.string(),
  timestamp: z.string(),
});
export type GetSentimentResponse = z.output<typeof GetSentimentResponseSchema>;
