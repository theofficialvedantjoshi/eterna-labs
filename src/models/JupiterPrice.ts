export interface stats {
  priceChange: number;
  buyVolume: number;
  sellVolume: number;
  numSells: number;
  numBuys: number;
}
export interface JupiterToken {
  id: string;
  name: string;
  symbol: string;
  mcap: number;
  usdPrice: number;
  liquidity: number;
  stats1h: stats;
  stats6h: stats;
  stats24h: stats;
}
