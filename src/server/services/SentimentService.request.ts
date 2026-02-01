/**
 * Sentiment Service - Request Schemas
 */

import { z } from 'zod';

/**
 * Base schema for get_sentiment tool (used for MCP tool registration).
 * This schema is used to describe the input shape without refinements.
 */
export const GetSentimentRequestBaseSchema = z.object({
  isin: z.string().optional().describe('ISIN to analyze news sentiment for'),
  text: z.string().optional().describe('Custom text to analyze'),
  newsLimit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .optional()
    .describe('Number of news articles to analyze (default: 5)'),
});

/**
 * Request schema for get_sentiment tool with validation.
 * Analyzes sentiment for text or news articles.
 * Requires either isin or text to be provided.
 */
export const GetSentimentRequestSchema = GetSentimentRequestBaseSchema.refine(
  (data) => data.isin !== undefined || data.text !== undefined,
  {
    message: 'Either isin or text must be provided',
  },
);

export type GetSentimentRequest = z.output<typeof GetSentimentRequestSchema>;
