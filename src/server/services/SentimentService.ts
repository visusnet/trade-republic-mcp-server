/**
 * Sentiment Service
 *
 * Analyzes sentiment for text or news articles using the AFINN-165 wordlist.
 */

import Sentiment from 'sentiment';

import { logger } from '../../logger';
import type { NewsService } from './NewsService';
import type { GetSentimentRequest } from './SentimentService.request';
import {
  GetSentimentResponseSchema,
  type GetSentimentResponse,
  type SentimentConfidence,
  type SentimentDirection,
  type TextSentiment,
} from './SentimentService.response';
import {
  SentimentServiceError,
  type SentimentResult,
} from './SentimentService.types';
import { FINANCE_SENTIMENT_WORDS } from './SentimentService.wordlist';

const DEFAULT_NEWS_LIMIT = 5;
const POSITIVE_THRESHOLD = 0.1;
const NEGATIVE_THRESHOLD = -0.1;
const MAX_COMPARATIVE = 5;
const NORMALIZATION_FACTOR = 20;
const HIGH_AGREEMENT_THRESHOLD = 0.75;
const MEDIUM_AGREEMENT_THRESHOLD = 0.5;
const HIGH_INTENSITY_THRESHOLD = 3;
const MEDIUM_INTENSITY_THRESHOLD = 1;

/**
 * Service for analyzing sentiment.
 */
export class SentimentService {
  private readonly newsService: NewsService;
  private readonly sentiment = new Sentiment();

  constructor(newsService: NewsService) {
    this.newsService = newsService;
  }

  /**
   * Analyze sentiment for text or news.
   * @param request - The sentiment request
   * @returns Sentiment analysis results
   * @throws SentimentServiceError if analysis fails
   */
  public async getSentiment(
    request: GetSentimentRequest,
  ): Promise<GetSentimentResponse> {
    logger.api.info(
      { isin: request.isin, hasText: !!request.text },
      'Analyzing sentiment',
    );

    if (request.text !== undefined) {
      return Promise.resolve(this.analyzeText(request.text));
    }

    // At this point, isin must be defined per the schema refinement
    const isin = request.isin as string;
    return this.analyzeNewsForIsin(
      isin,
      request.newsLimit ?? DEFAULT_NEWS_LIMIT,
    );
  }

  private analyzeText(text: string): GetSentimentResponse {
    if (!text.trim()) {
      throw new SentimentServiceError('Text cannot be empty');
    }

    const sentimentResult = this.analyzeSentiment(text);
    const textSentiment = this.createTextSentiment(text, sentimentResult);
    const normalizedScore = this.normalizeScore(sentimentResult.comparative);

    return GetSentimentResponseSchema.parse({
      overallScore: normalizedScore,
      overallDirection: this.getOverallDirection(normalizedScore),
      confidence: 'low',
      analysis: [textSentiment],
      summary: this.generateSummary(
        this.getOverallDirection(normalizedScore),
        1,
        false,
      ),
      timestamp: new Date().toISOString(),
    });
  }

  private async analyzeNewsForIsin(
    isin: string,
    limit: number,
  ): Promise<GetSentimentResponse> {
    let newsData;
    try {
      newsData = await this.newsService.getNews({ isin, limit });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SentimentServiceError(`Failed to get sentiment: ${message}`);
    }

    const analysis: TextSentiment[] = [];
    const comparativeScores: number[] = [];

    for (const article of newsData.articles) {
      const sentimentResult = this.analyzeSentiment(article.title);
      analysis.push(this.createTextSentiment(article.title, sentimentResult));
      comparativeScores.push(sentimentResult.comparative);
    }

    const avgComparative =
      comparativeScores.length > 0
        ? comparativeScores.reduce((a, b) => a + b, 0) /
          comparativeScores.length
        : 0;
    const normalizedScore = this.normalizeScore(avgComparative);
    const overallDirection = this.getOverallDirection(normalizedScore);
    const confidence = this.calculateConfidence(analysis, comparativeScores);

    logger.api.debug(
      {
        isin,
        symbol: newsData.symbol,
        articleCount: analysis.length,
        overallScore: normalizedScore,
      },
      'Completed sentiment analysis',
    );

    return GetSentimentResponseSchema.parse({
      isin,
      symbol: newsData.symbol,
      overallScore: normalizedScore,
      overallDirection,
      confidence,
      analysis,
      summary: this.generateSummary(overallDirection, analysis.length, true),
      timestamp: new Date().toISOString(),
    });
  }

  private analyzeSentiment(text: string): SentimentResult {
    return this.sentiment.analyze(text, { extras: FINANCE_SENTIMENT_WORDS });
  }

  private createTextSentiment(
    text: string,
    result: SentimentResult,
  ): TextSentiment {
    return {
      text,
      score: result.score,
      comparative: result.comparative,
      direction: this.getDirection(result.comparative),
      positiveWords: result.positive,
      negativeWords: result.negative,
    };
  }

  private getDirection(comparative: number): SentimentDirection {
    if (comparative > POSITIVE_THRESHOLD) {
      return 'positive';
    }
    if (comparative < NEGATIVE_THRESHOLD) {
      return 'negative';
    }
    return 'neutral';
  }

  private getOverallDirection(normalizedScore: number): SentimentDirection {
    if (normalizedScore > 0) {
      return 'positive';
    }
    if (normalizedScore < 0) {
      return 'negative';
    }
    return 'neutral';
  }

  private normalizeScore(comparative: number): number {
    const clamped = Math.max(
      -MAX_COMPARATIVE,
      Math.min(MAX_COMPARATIVE, comparative),
    );
    return Math.round(clamped * NORMALIZATION_FACTOR);
  }

  private calculateConfidence(
    analysis: TextSentiment[],
    comparativeScores: number[],
  ): SentimentConfidence {
    if (analysis.length === 0) {
      return 'low';
    }

    const positiveCount = analysis.filter(
      (a) => a.direction === 'positive',
    ).length;
    const negativeCount = analysis.filter(
      (a) => a.direction === 'negative',
    ).length;
    const dominantCount = Math.max(positiveCount, negativeCount);
    const agreement = dominantCount / analysis.length;

    const avgIntensity =
      comparativeScores.reduce((a, b) => a + Math.abs(b), 0) /
      comparativeScores.length;

    if (
      agreement >= HIGH_AGREEMENT_THRESHOLD &&
      avgIntensity > HIGH_INTENSITY_THRESHOLD
    ) {
      return 'high';
    }

    if (
      agreement >= MEDIUM_AGREEMENT_THRESHOLD &&
      avgIntensity > MEDIUM_INTENSITY_THRESHOLD
    ) {
      return 'medium';
    }

    return 'low';
  }

  private generateSummary(
    direction: SentimentDirection,
    articleCount: number,
    isIsinAnalysis: boolean,
  ): string {
    if (isIsinAnalysis) {
      const articleWord = articleCount === 1 ? 'article' : 'articles';
      return `Analyzed ${articleCount} ${articleWord}. Overall sentiment is ${direction}.`;
    }
    return `Sentiment analysis indicates ${direction} sentiment.`;
  }
}
