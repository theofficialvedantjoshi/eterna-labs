import axios, { AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import Paths from "@src/common/constants/urls";
import { JupiterToken } from "@src/models/JupiterPrice";

const jupiterPriceApi = axios.create({ baseURL: Paths.JupiterPrice });

axiosRetry(jupiterPriceApi, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay.bind(axiosRetry),
});

export class JupiterPriceClient {
  public async getTokens(
    tokenAddresses: string
  ): Promise<JupiterToken[] | null> {
    try {
      const response: AxiosResponse<JupiterToken[]> = await jupiterPriceApi.get(
        "",
        {
          params: {
            query: tokenAddresses,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching tokens from Jupiter Price API:", error);
      return null;
    }
  }
}
