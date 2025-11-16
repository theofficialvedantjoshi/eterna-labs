export interface Token {
  token_address: string;
  token_name: string;
  token_ticker: string;
  price_usd: number;
  market_cap_usd: number;
  liquidity_usd: number;
  protocol: string;
  stats: { h1: stats; h6: stats; h24: stats };
}

export interface TokenResponse {
  token_address: string;
  token_name: string;
  token_ticker: string;
  price_usd: number;
  market_cap_usd: number;
  liquidity_usd: number;
  protocol: string;
  stats: stats;
}

export interface stats {
  price_change: number;
  transaction_count: number;
  volume: number;
}

export interface PaginatedTokenResponse {
  tokens: TokenResponse[];
  next_cursor: number | null;
}

export const sorts = ["market_cap", "volume", "price_change"];
export const timePeriods = ["1h", "6h", "24h"];
