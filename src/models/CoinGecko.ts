export interface CoinGeckoToken {
  data: CoinGeckoTokenData[];
}
export interface CoinGeckoTokenData {
  id: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    price_usd: number;
    volume_usd: {
      h24: number;
    };
    market_cap_usd: number;
  };
}

export interface CoinGeckoRecentlyUpdatedTokens {
  data: CoinGeckoRecentlyUpdatedToken[];
}
export interface CoinGeckoRecentlyUpdatedToken {
  id: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
  };
}
