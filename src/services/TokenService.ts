import { Server as SocketIOServer } from "socket.io";
import {
  stats,
  Token,
  TokenResponse,
  PaginatedTokenResponse,
} from "@src/models/Token";
import { TokenCacheRepo } from "@src/repos/TokenCacheRepo";
import { JupiterPriceClient } from "@src/clients/JupiterPrice";
import { DexScreenerClient } from "@src/clients/DexScreener";
import { CoinGeckoClient } from "@src/clients/CoinGecko";
import { CoinGeckoTokenData, CoinGeckoToken } from "@src/models/CoinGecko";
import { JupiterToken } from "@src/models/JupiterPrice";
import { DexScreenerTokenPair } from "@src/models/DexScreener";

export class TokenService {
  private tokenCacheRepo: TokenCacheRepo;
  private jupiterPriceClient: JupiterPriceClient;
  private dexScreenerClient: DexScreenerClient;
  private coinGeckoClient: CoinGeckoClient;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.tokenCacheRepo = new TokenCacheRepo();
    this.jupiterPriceClient = new JupiterPriceClient();
    this.dexScreenerClient = new DexScreenerClient();
    this.coinGeckoClient = new CoinGeckoClient();
  }
  public async refreshTokens(): Promise<void> {
    console.log("Refreshing tokens...");
    const prevTokens = (await this.tokenCacheRepo.getTokens()) ?? [];

    const isAlphanumeric = (s: string) => /^[A-Za-z0-9]+$/.test(s);
    const coinGeckoTokensList = await this.coinGeckoClient.getTokens();
    if (!coinGeckoTokensList) {
      console.error("Failed to fetch tokens from CoinGecko");
      return;
    }
    const allTokenAddresses: string[] = [];
    for (const tokenData of coinGeckoTokensList.data) {
      const address = tokenData.attributes.address;
      if (isAlphanumeric(address)) {
        allTokenAddresses.push(address);
      }
    }
    const tokenMap = await this.getTokenMap(allTokenAddresses);
    const updatedTokens = this.getAggregateToken(tokenMap);
    console.log(`Fetched ${updatedTokens.length} tokens.`);
    const updates = this.getUpdates(prevTokens, updatedTokens);
    if (updates.length > 0) {
      this.io.emit("token_updates", updates);
    }
    await this.tokenCacheRepo.setTokens(updatedTokens);
  }

  public async getPaginatedTokens(
    limit = 20,
    cursor = 0,
    sortBy = "market_cap",
    timePeriod = "1h"
  ): Promise<PaginatedTokenResponse> {
    let tokens = await this.tokenCacheRepo.getTokens();
    if (!tokens) {
      await this.refreshTokens();
      tokens = (await this.tokenCacheRepo.getTokens()) ?? [];
    }
    const paginated = tokens.slice(cursor, cursor + limit);
    const tokenResponses: TokenResponse[] = [];
    for (const token of paginated) {
      if (timePeriod === "1h") {
        tokenResponses.push({
          ...token,
          stats: token.stats.h1,
        });
      } else if (timePeriod === "6h") {
        tokenResponses.push({
          ...token,
          stats: token.stats.h6,
        });
      } else if (timePeriod === "24h") {
        tokenResponses.push({
          ...token,
          stats: token.stats.h24,
        });
      }
    }
    if (sortBy === "market_cap") {
      tokenResponses.sort((a, b) => b.market_cap_usd - a.market_cap_usd);
    } else if (sortBy === "volume") {
      tokenResponses.sort((a, b) => b.stats.volume - a.stats.volume);
    } else if (sortBy === "price_change") {
      tokenResponses.sort(
        (a, b) => b.stats.price_change - a.stats.price_change
      );
    }
    const nextCursor = tokens.length > cursor + limit ? cursor + limit : null;
    return {
      tokens: tokenResponses,
      next_cursor: nextCursor,
    };
  }

  private getAggregateToken(
    tokenMap: Map<
      string,
      {
        dexScreenerData?: DexScreenerTokenPair;
        coinGeckoData?: CoinGeckoTokenData;
        jupiterPriceData?: JupiterToken;
      }
    >
  ): Token[] {
    const updatedTokens: Token[] = [];
    for (const [address, data] of tokenMap.entries()) {
      const updatedToken: Token = {} as Token;
      updatedToken.token_address = address;

      updatedToken.token_name =
        data.dexScreenerData?.baseToken.name ??
        data.coinGeckoData?.attributes.name ??
        "N/A";
      updatedToken.token_ticker =
        data.dexScreenerData?.baseToken.symbol ??
        data.coinGeckoData?.attributes.symbol ??
        "N/A";

      updatedToken.price_usd =
        data.jupiterPriceData?.usdPrice ??
        data.dexScreenerData?.priceUsd ??
        data.coinGeckoData?.attributes.price_usd ??
        0;
      updatedToken.liquidity_usd =
        data.jupiterPriceData?.liquidity ??
        data.dexScreenerData?.liquidity.usd ??
        0;
      updatedToken.market_cap_usd =
        data.dexScreenerData?.marketCap ??
        data.coinGeckoData?.attributes.market_cap_usd ??
        0;

      updatedToken.stats = {} as { h1: stats; h6: stats; h24: stats };
      const jupiterStatsMap = {
        h1: data.jupiterPriceData?.stats1h,
        h6: data.jupiterPriceData?.stats6h,
        h24: data.jupiterPriceData?.stats24h,
      };
      const jupiterVolumeMap = {
        h1: jupiterStatsMap.h1
          ? (jupiterStatsMap.h1.buyVolume ?? 0) +
            (jupiterStatsMap.h1.sellVolume ?? 0)
          : 0,
        h6: jupiterStatsMap.h6
          ? (jupiterStatsMap.h6.buyVolume ?? 0) +
            (jupiterStatsMap.h6.sellVolume ?? 0)
          : 0,
        h24: jupiterStatsMap.h24
          ? (jupiterStatsMap.h24.buyVolume ?? 0) +
            (jupiterStatsMap.h24.sellVolume ?? 0)
          : 0,
      };
      const jupiterTransactionMap = {
        h1: jupiterStatsMap.h1
          ? (jupiterStatsMap.h1.numBuys ?? 0) +
            (jupiterStatsMap.h1.numSells ?? 0)
          : 0,
        h6: jupiterStatsMap.h6
          ? (jupiterStatsMap.h6.numBuys ?? 0) +
            (jupiterStatsMap.h6.numSells ?? 0)
          : 0,
        h24: jupiterStatsMap.h24
          ? (jupiterStatsMap.h24.numBuys ?? 0) +
            (jupiterStatsMap.h24.numSells ?? 0)
          : 0,
      };
      updatedToken.stats.h1 = {
        volume: jupiterVolumeMap.h1 ?? data.dexScreenerData?.volume.h1 ?? 0,
        price_change:
          jupiterStatsMap.h1?.priceChange ??
          data.dexScreenerData?.priceChange.h1 ??
          0,
        transaction_count:
          jupiterTransactionMap.h1 ??
          (data.dexScreenerData
            ? data.dexScreenerData?.txns?.h1?.buys +
              data.dexScreenerData?.txns?.h1?.sells
            : 0),
      };
      updatedToken.stats.h6 = {
        volume: jupiterVolumeMap.h6 ?? data.dexScreenerData?.volume.h6 ?? 0,
        price_change:
          jupiterStatsMap.h6?.priceChange ??
          data.dexScreenerData?.priceChange.h6 ??
          0,
        transaction_count:
          jupiterTransactionMap.h6 ??
          (data.dexScreenerData
            ? data.dexScreenerData?.txns?.h6?.buys +
              data.dexScreenerData?.txns?.h6?.sells
            : 0),
      };
      updatedToken.stats.h24 = {
        volume: jupiterVolumeMap.h24 ?? data.dexScreenerData?.volume.h24 ?? 0,
        price_change:
          jupiterStatsMap.h24?.priceChange ??
          data.dexScreenerData?.priceChange.h24 ??
          0,
        transaction_count:
          jupiterTransactionMap.h24 ??
          (data.dexScreenerData
            ? data.dexScreenerData?.txns?.h24?.buys +
              data.dexScreenerData?.txns?.h24?.sells
            : 0),
      };
      updatedTokens.push(updatedToken);
    }
    return updatedTokens;
  }

  private async getTokenMap(allTokenAddresses: string[]): Promise<
    Map<
      string,
      {
        dexScreenerData?: DexScreenerTokenPair;
        coinGeckoData?: CoinGeckoTokenData;
        jupiterPriceData?: JupiterToken;
      }
    >
  > {
    const tokenAdressChunks: string[][] = [];
    for (let i = 0; i < allTokenAddresses.length; i += 30) {
      tokenAdressChunks.push(allTokenAddresses.slice(i, i + 30));
    }
    const dexScreenerTokens: DexScreenerTokenPair[] = [];
    const coinGeckoTokens: CoinGeckoToken = { data: [] };
    for (const chunk of tokenAdressChunks) {
      const [dsTokens, cgTokens] = await Promise.all([
        this.dexScreenerClient.getTokensByAddress(chunk.join(",")),
        this.coinGeckoClient.getTokensByAddress(chunk.join(",")),
      ]);
      dexScreenerTokens.push(...dsTokens);
      if (cgTokens) {
        coinGeckoTokens.data.push(...cgTokens.data);
      }
    }
    const jupiterTokens = await this.jupiterPriceClient.getTokens(
      allTokenAddresses.join(",")
    );
    const tokenMap = new Map<
      string,
      {
        dexScreenerData?: DexScreenerTokenPair;
        coinGeckoData?: CoinGeckoTokenData;
        jupiterPriceData?: JupiterToken;
      }
    >();
    for (const pair of dexScreenerTokens) {
      const prevData = tokenMap.get(pair.baseToken.address) ?? {};
      prevData.dexScreenerData = pair;
      tokenMap.set(pair.baseToken.address, prevData);
    }
    if (coinGeckoTokens) {
      for (const cgTokenData of coinGeckoTokens.data) {
        const prevData = tokenMap.get(cgTokenData.attributes.address) ?? {};
        prevData.coinGeckoData = cgTokenData;
        tokenMap.set(cgTokenData.attributes.address, prevData);
      }
    }
    if (jupiterTokens) {
      for (const jupiterToken of jupiterTokens) {
        const prevData = tokenMap.get(jupiterToken.id) ?? {};
        prevData.jupiterPriceData = jupiterToken;
        tokenMap.set(jupiterToken.id, prevData);
      }
    }
    return tokenMap;
  }

  private getUpdates(prevTokens: Token[], newTokens: Token[]): Token[] {
    const updates: Token[] = [];
    const prevTokenMap = new Map<string, Token>();
    for (const token of prevTokens) {
      prevTokenMap.set(token.token_address, token);
    }
    for (const newToken of newTokens) {
      const prevToken = prevTokenMap.get(newToken.token_address);
      if (
        !prevToken ||
        prevToken.price_usd !== newToken.price_usd ||
        prevToken.market_cap_usd !== newToken.market_cap_usd ||
        prevToken.liquidity_usd !== newToken.liquidity_usd ||
        prevToken?.stats.h1.volume !== newToken.stats.h1.volume ||
        prevToken.stats.h6.volume !== newToken.stats.h6.volume ||
        prevToken.stats.h24.volume !== newToken.stats.h24.volume
      ) {
        updates.push(newToken);
      }
    }
    return updates;
  }
}
