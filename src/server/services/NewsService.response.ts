/**
 * News Service - Response Schemas
 */

import { z } from 'zod';

/**
 * Schema for a news article.
 */
export const NewsArticleSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  link: z.string().url(),
  publishedAt: z.string(),
  thumbnail: z.string().url().optional(),
});

export type NewsArticle = z.output<typeof NewsArticleSchema>;

/**
 * Response schema for get_news tool.
 */
export const GetNewsResponseSchema = z.object({
  isin: z.string(),
  symbol: z.string(),
  articles: z.array(NewsArticleSchema),
  totalCount: z.number(),
  timestamp: z.string(),
});

export type GetNewsResponse = z.output<typeof GetNewsResponseSchema>;
