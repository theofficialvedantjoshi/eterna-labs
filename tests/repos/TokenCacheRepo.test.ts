import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenCacheRepo } from "@src/repos/TokenCacheRepo";
import { createToken } from "../scripts/tokenGenerator";

const mockSet = vi.fn();
const mockGet = vi.fn();

vi.mock("ioredis", () => ({
  default: class RedisMock {
    public set = mockSet;
    public get = mockGet;
  },
}));

describe("TokenCacheRepo", () => {
  beforeEach(() => {
    mockSet.mockReset();
    mockGet.mockReset();
  });

  it("persists tokens with TTL", async () => {
    const repo = new TokenCacheRepo();
    const tokens = [createToken()];

    await repo.setTokens(tokens);

    expect(mockSet).toHaveBeenCalledWith(
      "tokens:all",
      JSON.stringify(tokens),
      "EX",
      30
    );
  });

  it("returns parsed tokens when cache is primed", async () => {
    const repo = new TokenCacheRepo();
    const tokens = [createToken({ token_address: "A" })];
    mockGet.mockResolvedValueOnce(JSON.stringify(tokens));

    const result = await repo.getTokens();

    expect(result).toEqual(tokens);
  });

  it("returns null when cache miss occurs", async () => {
    const repo = new TokenCacheRepo();
    mockGet.mockResolvedValueOnce(null);

    const result = await repo.getTokens();

    expect(result).toBeNull();
  });
});
