interface Token {
  name: string;
  address: string;
  symbol: string;
}
interface Transaction {
  buys: number;
  sells: number;
}
export interface DexScreenerTokens {
  pairs: DexScreenerTokenPair[];
}
export interface DexScreenerTokenPair {
  chain_id: string;
  dexId: string;
  pair_address: string;
  baseToken: Token;
  quoteToken: Token;
  priceUsd: number;
  txns: {
    h1: Transaction;
    h6: Transaction;
    h24: Transaction;
  };
  volume: { h1: number; h6: number; h24: number };
  priceChange: { h1: number; h6: number; h24: number };
  liquidity: { usd: number };
  marketCap: number;
}
