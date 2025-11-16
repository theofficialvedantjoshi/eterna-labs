import Redis from "ioredis";
import { Token } from "@src/models/Token";
import ENV from "@src/common/constants/ENV";

const KEY = "tokens:all";
const CACHE_TTL = ENV.CacheTtlSeconds | 30;

export class TokenCacheRepo {
  private redis: Redis;
  constructor() {
    this.redis = new Redis();
  }
  public async setTokens(tokens: Token[]): Promise<void> {
    await this.redis.set(KEY, JSON.stringify(tokens), "EX", CACHE_TTL);
  }
  public async getTokens(): Promise<Token[] | null> {
    const tokenString = await this.redis.get(KEY);
    if (!tokenString) {
      return null;
    }
    return JSON.parse(tokenString) as Token[];
  }
}
