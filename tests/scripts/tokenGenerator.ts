import { Token } from "@src/models/Token";
import { CoinGeckoTokenData } from "@src/models/CoinGecko";
import { DexScreenerTokenPair } from "@src/models/DexScreener";
import { JupiterToken } from "@src/models/JupiterPrice";

export const createToken = (overrides?: Partial<Token>): Token => ({
  token_address: "ADDR",
  token_name: "Token",
  token_ticker: "TKN",
  price_usd: 1,
  market_cap_usd: 1_000,
  liquidity_usd: 500,
  protocol: "solana",
  stats: {
    h1: { price_change: 1, transaction_count: 10, volume: 100 },
    h6: { price_change: 2, transaction_count: 20, volume: 200 },
    h24: { price_change: 3, transaction_count: 30, volume: 300 },
  },
  ...overrides,
});

export const createDexPair = (
  overrides?: Partial<DexScreenerTokenPair>
): DexScreenerTokenPair => ({
  chain_id: "solana",
  dexId: "dex",
  pair_address: "pair",
  baseToken: {
    name: "Token",
    address: "ADDR",
    symbol: "TKN",
    ...overrides?.baseToken,
  },
  quoteToken: {
    name: "Quote",
    address: "QADDR",
    symbol: "QTKN",
    ...overrides?.quoteToken,
  },
  priceUsd: 1,
  txns: {
    h1: { buys: 1, sells: 1 },
    h6: { buys: 2, sells: 2 },
    h24: { buys: 3, sells: 3 },
  },
  volume: { h1: 10, h6: 20, h24: 30 },
  priceChange: { h1: 1, h6: 2, h24: 3 },
  liquidity: { usd: 100 },
  marketCap: 1_000,
  ...overrides,
});

export const createCoinGeckoTokenData = (
  overrides?: Partial<CoinGeckoTokenData>
): CoinGeckoTokenData => ({
  id: "cg",
  attributes: {
    address: "ADDR",
    name: "CoinGecko",
    symbol: "CG",
    price_usd: 1,
    volume_usd: { h24: 100 },
    market_cap_usd: 1_000,
    ...overrides?.attributes,
  },
  ...overrides,
});

const baseStats = {
  priceChange: 1,
  buyVolume: 10,
  sellVolume: 5,
  numSells: 3,
  numBuys: 2,
};

export const createJupiterToken = (
  overrides?: Partial<JupiterToken>
): JupiterToken => ({
  id: "ADDR",
  name: "Jupiter",
  symbol: "JUP",
  mcap: 1_000,
  usdPrice: 1,
  liquidity: 100,
  stats1h: { ...baseStats },
  stats6h: { ...baseStats },
  stats24h: { ...baseStats },
  ...overrides,
});
