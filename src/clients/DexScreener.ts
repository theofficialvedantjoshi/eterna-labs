import axios, { AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import Paths from "@src/common/constants/urls";
import {
  DexScreenerTokens,
  DexScreenerTokenPair,
} from "@src/models/DexScreener";

const dexScreenerApi = axios.create({ baseURL: Paths.DexScreener });

axiosRetry(dexScreenerApi, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay.bind(axiosRetry),
});

export class DexScreenerClient {
  public async getTokensByAddress(
    tokenAddresses: string
  ): Promise<DexScreenerTokenPair[]> {
    try {
      const response: AxiosResponse<DexScreenerTokenPair[]> =
        await dexScreenerApi.get(`/tokens/v1/solana/${tokenAddresses}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching tokens from DexScreener API:", error);
      return [];
    }
  }
  public async getTokens(): Promise<DexScreenerTokens> {
    try {
      const response: AxiosResponse<DexScreenerTokens> =
        await dexScreenerApi.get("/latest/dex/search", {
          params: {
            q: "sol",
          },
        });
      return response.data;
    } catch (error) {
      console.error("Error fetching tokens from Jupiter Price API:", error);
      return { pairs: [] };
    }
  }
}
