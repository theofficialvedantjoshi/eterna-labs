import axios, { AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import Paths from "@src/common/constants/urls";
import {
  CoinGeckoToken,
  CoinGeckoRecentlyUpdatedTokens,
} from "@src/models/CoinGecko";
import ENV from "@src/common/constants/ENV";

const coinGeckoApi = axios.create({
  baseURL: Paths.CoinGecko,
  headers: {
    "x-cg-demo-api-key": ENV.CoingeckoApiKey,
  },
});

axiosRetry(coinGeckoApi, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay.bind(axiosRetry),
});

export class CoinGeckoClient {
  public async getTokensByAddress(
    tokenAdresses: string
  ): Promise<CoinGeckoToken | null> {
    try {
      const response: AxiosResponse<CoinGeckoToken> = await coinGeckoApi.get(
        `/networks/solana/tokens/multi/${encodeURIComponent(tokenAdresses)}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching tokens from Jupiter Price API:", error);
      return null;
    }
  }
  public async getTokens(): Promise<CoinGeckoRecentlyUpdatedTokens | null> {
    try {
      const response: AxiosResponse<CoinGeckoRecentlyUpdatedTokens> =
        await coinGeckoApi.get(`tokens/info_recently_updated?network=solana`);
      return response.data;
    } catch (error) {
      console.error(
        "Error fetching recently updated tokens from CoinGecko API:",
        error
      );
      return null;
    }
  }
}
