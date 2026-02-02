/**
 * Finance-specific sentiment words for enhanced trading context analysis.
 *
 * These words supplement the AFINN-165 wordlist with terms commonly used
 * in financial news, earnings reports, and market analysis.
 *
 * Scores range from -5 (most negative) to +5 (most positive).
 */

export const FINANCE_SENTIMENT_WORDS: Record<string, number> = {
  // Strong positive signals (+3 to +5)
  bullish: 3,
  outperform: 3,
  upgrade: 3,
  breakout: 3,
  rally: 3,
  surge: 3,
  soar: 4,
  skyrocket: 4,
  boom: 3,
  moonshot: 4,

  // Moderate positive signals (+2)
  beat: 2,
  exceeds: 2,
  growth: 2,
  gains: 2,
  upside: 2,
  recovery: 2,
  rebound: 2,
  momentum: 2,
  accumulate: 2,
  overweight: 2,
  buyback: 2,
  dividend: 2,
  profitable: 2,
  expansion: 2,

  // Mild positive signals (+1)
  buy: 1,
  call: 1,
  long: 1,
  hold: 1,
  stable: 1,
  steady: 1,
  resilient: 1,
  diversified: 1,

  // Mild negative signals (-1)
  put: -1,
  short: -1,
  hedge: 0, // Neutral risk management (per ADR-012)
  underweight: -1,
  cautious: -1,
  volatile: -1,
  uncertainty: -1,
  headwinds: -1,
  slowdown: -1,

  // Moderate negative signals (-2)
  sell: -2,
  miss: -2,
  decline: -2,
  drop: -2,
  loss: -2,
  weak: -2,
  downside: -2,
  recession: -2,
  layoffs: -2,
  writedown: -2,
  impairment: -2,
  dilution: -2,
  overvalued: -2,

  // Strong negative signals (-3 to -5)
  bearish: -3,
  underperform: -3,
  downgrade: -3,
  plunge: -3,
  tumble: -3,
  slump: -3,
  crash: -4,
  collapse: -4,
  bankruptcy: -4,
  default: -4,
  fraud: -5,
  scandal: -4,
  investigation: -3,
  lawsuit: -3,
  warning: -2,
  guidance: 0,

  // Analyst actions
  reiterate: 1,
  maintain: 0,
  initiate: 1,
  coverage: 0,
  target: 0,

  // Financial metrics context
  revenue: 0,
  earnings: 0,
  eps: 0,
  margin: 0,
  ebitda: 0,
  cashflow: 1,
  debt: -1,
  leverage: -1,

  // Market conditions
  overbought: -1,
  oversold: 1,
  correction: -2,
  consolidation: 0,
  breakeven: 0,
  turnaround: 2,

  // Trading terms
  squeeze: 1,
  covering: 1,
  capitulation: -3,
  panic: -3,
  euphoria: -1,
  fomo: -1,
  fud: -2,
};
