import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createTokenRoutes } from "@src/routes/TokenRoutes";
import type { TokenService } from "@src/services/TokenService";

const buildApp = (tokenService: Pick<TokenService, "getPaginatedTokens">) => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/tokens", createTokenRoutes(tokenService as TokenService));
  return app;
};

describe("TokenRoutes", () => {
  it("rejects invalid query parameters", async () => {
    const tokenService = {
      getPaginatedTokens: vi.fn(),
    } satisfies Pick<TokenService, "getPaginatedTokens">;
    const app = buildApp(tokenService);

    const response = await request(app).get(
      "/api/v1/tokens?limit=-1&cursor=-5&sort_by=foo&time_period=99h"
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Invalid query parameters" });
    expect(tokenService.getPaginatedTokens).not.toHaveBeenCalled();
  });

  it("returns paginated tokens for valid requests", async () => {
    const tokenService = {
      getPaginatedTokens: vi.fn().mockResolvedValue({
        tokens: [
          {
            token_address: "ADDR",
            token_name: "Token",
            token_ticker: "TKN",
            price_usd: 1,
            market_cap_usd: 1_000,
            liquidity_usd: 500,
            protocol: "solana",
            stats: { price_change: 1, transaction_count: 2, volume: 3 },
          },
        ],
        next_cursor: 15,
      }),
    } satisfies Pick<TokenService, "getPaginatedTokens">;
    const app = buildApp(tokenService);

    const response = await request(app).get(
      "/api/v1/tokens?limit=5&cursor=10&sort_by=volume&time_period=6h"
    );
    const body = response.body as {
      tokens: Record<string, unknown>[];
      next_cursor: number;
    };

    expect(response.status).toBe(200);
    expect(body.tokens).toHaveLength(1);
    expect(body.next_cursor).toBe(15);
    expect(tokenService.getPaginatedTokens).toHaveBeenCalledWith(
      5,
      10,
      "volume",
      "6h"
    );
  });
});
