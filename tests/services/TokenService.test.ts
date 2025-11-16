import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenService } from "@src/services/TokenService";
import { createToken } from "../scripts/tokenGenerator";
import type { Server as SocketIOServer } from "socket.io";

interface ServiceContext {
  service: TokenService;
  emit: ReturnType<typeof vi.fn>;
  cacheGet: ReturnType<typeof vi.fn>;
  cacheSet: ReturnType<typeof vi.fn>;
  coinGeckoGetTokens: ReturnType<typeof vi.fn>;
}

const buildService = (): ServiceContext => {
  const emit = vi.fn();
  const service = new TokenService({ emit } as unknown as SocketIOServer);

  const cacheGet = vi.fn();
  const cacheSet = vi.fn();
  (service as unknown as { tokenCacheRepo: unknown }).tokenCacheRepo = {
    getTokens: cacheGet,
    setTokens: cacheSet,
  };

  const coinGeckoGetTokens = vi.fn();
  (service as unknown as { coinGeckoClient: unknown }).coinGeckoClient = {
    getTokens: coinGeckoGetTokens,
  };

  (service as unknown as { dexScreenerClient: unknown }).dexScreenerClient = {
    getTokensByAddress: vi.fn(),
  };
  (service as unknown as { jupiterPriceClient: unknown }).jupiterPriceClient = {
    getTokens: vi.fn(),
  };

  return { service, emit, cacheGet, cacheSet, coinGeckoGetTokens };
};

describe("TokenService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated tokens with requested time period stats", async () => {
    const { service, cacheGet } = buildService();
    const tokenA = createToken({
      token_address: "A",
      market_cap_usd: 200,
      stats: {
        h1: { price_change: 1, transaction_count: 10, volume: 100 },
        h6: { price_change: 6, transaction_count: 60, volume: 600 },
        h24: { price_change: 24, transaction_count: 240, volume: 2400 },
      },
    });
    const tokenB = createToken({ token_address: "B", market_cap_usd: 100 });
    cacheGet.mockResolvedValue([tokenA, tokenB]);

    const result = await service.getPaginatedTokens(1, 0, "market_cap", "6h");

    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].token_address).toBe("A");
    expect(result.tokens[0].stats).toEqual(tokenA.stats.h6);
    expect(result.next_cursor).toBe(1);
  });

  it("sorts tokens by volume when requested", async () => {
    const { service, cacheGet } = buildService();
    cacheGet.mockResolvedValue([
      createToken({
        token_address: "A",
        stats: {
          h1: { price_change: 1, transaction_count: 1, volume: 10 },
          h6: { price_change: 1, transaction_count: 1, volume: 10 },
          h24: { price_change: 1, transaction_count: 1, volume: 10 },
        },
      }),
      createToken({
        token_address: "B",
        stats: {
          h1: { price_change: 1, transaction_count: 1, volume: 100 },
          h6: { price_change: 1, transaction_count: 1, volume: 100 },
          h24: { price_change: 1, transaction_count: 1, volume: 100 },
        },
      }),
    ]);

    const result = await service.getPaginatedTokens(10, 0, "volume", "1h");

    expect(result.tokens[0].token_address).toBe("B");
    expect(result.tokens[1].token_address).toBe("A");
  });

  it("sorts tokens by price change", async () => {
    const { service, cacheGet } = buildService();
    cacheGet.mockResolvedValue([
      createToken({
        token_address: "A",
        stats: {
          h1: { price_change: 2, transaction_count: 1, volume: 10 },
          h6: { price_change: 2, transaction_count: 1, volume: 10 },
          h24: { price_change: 2, transaction_count: 1, volume: 10 },
        },
      }),
      createToken({
        token_address: "B",
        stats: {
          h1: { price_change: 10, transaction_count: 1, volume: 10 },
          h6: { price_change: 10, transaction_count: 1, volume: 10 },
          h24: { price_change: 10, transaction_count: 1, volume: 10 },
        },
      }),
    ]);

    const result = await service.getPaginatedTokens(
      10,
      0,
      "price_change",
      "1h"
    );

    expect(result.tokens[0].token_address).toBe("B");
    expect(result.tokens[1].token_address).toBe("A");
  });

  it("refreshes tokens when cache is empty", async () => {
    const { service, cacheGet } = buildService();
    const tokens = [createToken({ token_address: "A" })];
    cacheGet.mockResolvedValueOnce(null);
    cacheGet.mockResolvedValueOnce(tokens);
    const refreshSpy = vi.spyOn(service, "refreshTokens").mockResolvedValue();

    const result = await service.getPaginatedTokens();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(result.tokens).toHaveLength(1);
  });

  it("emits websocket updates when token deltas exist", async () => {
    const { service, cacheGet, cacheSet, coinGeckoGetTokens, emit } =
      buildService();
    const previousToken = createToken({
      token_address: "ADDR1",
      price_usd: 1,
      stats: {
        h1: { price_change: 1, transaction_count: 1, volume: 10 },
        h6: { price_change: 1, transaction_count: 1, volume: 10 },
        h24: { price_change: 1, transaction_count: 1, volume: 10 },
      },
    });
    cacheGet.mockResolvedValueOnce([previousToken]);
    cacheGet.mockResolvedValueOnce([previousToken]);

    coinGeckoGetTokens.mockResolvedValue({
      data: [
        {
          id: "1",
          attributes: { address: "ADDR1", name: "", symbol: "" },
        },
      ],
    });

    const updatedToken = createToken({
      token_address: "ADDR1",
      price_usd: 2,
      stats: {
        h1: { price_change: 2, transaction_count: 1, volume: 20 },
        h6: { price_change: 2, transaction_count: 1, volume: 20 },
        h24: { price_change: 2, transaction_count: 1, volume: 20 },
      },
    });

    vi.spyOn(
      service as unknown as { getTokenMap: () => unknown },
      "getTokenMap"
    ).mockResolvedValue(new Map([["ADDR1", {} as never]]));
    vi.spyOn(
      service as unknown as { getAggregateToken: () => unknown },
      "getAggregateToken"
    ).mockReturnValue([updatedToken]);

    await service.refreshTokens();

    expect(cacheSet).toHaveBeenCalledWith([updatedToken]);
    expect(emit).toHaveBeenCalledWith("token_updates", [updatedToken]);
  });

  it("does not emit when no updates detected but still caches", async () => {
    const { service, cacheGet, cacheSet, coinGeckoGetTokens, emit } =
      buildService();
    const existingToken = createToken({ token_address: "ADDR1" });
    cacheGet.mockResolvedValueOnce([existingToken]);
    cacheGet.mockResolvedValueOnce([existingToken]);

    coinGeckoGetTokens.mockResolvedValue({
      data: [
        {
          id: "1",
          attributes: { address: "ADDR1", name: "", symbol: "" },
        },
      ],
    });

    vi.spyOn(
      service as unknown as { getTokenMap: () => unknown },
      "getTokenMap"
    ).mockResolvedValue(new Map());
    vi.spyOn(
      service as unknown as { getAggregateToken: () => unknown },
      "getAggregateToken"
    ).mockReturnValue([existingToken]);

    await service.refreshTokens();

    expect(cacheSet).toHaveBeenCalledWith([existingToken]);
    expect(emit).not.toHaveBeenCalled();
  });
});
