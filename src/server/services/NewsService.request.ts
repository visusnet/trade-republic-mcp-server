/**
 * News Service - Request Schemas
 */

import { z } from 'zod';

/**
 * Request schema for get_news tool.
 * Retrieves news articles for an instrument.
 */
export const GetNewsRequestSchema = z.object({
  isin: z.string().describe('ISIN of the instrument'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of news articles (default: 10, max: 50)'),
});

export type GetNewsRequest = z.output<typeof GetNewsRequestSchema>;
