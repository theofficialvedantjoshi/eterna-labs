# Eterna Labs Backend Task 1

Real-time aggregation service that mirrors the axiom.trade "Discover" flow: pull trending meme-coin metadata from multiple public APIs, merge and cache the view, expose it through REST, and stream deltas over WebSockets.

## Overview

- **Data aggregation**: merges CoinGecko (recent tokens + metadata), DexScreener (pairs/liquidity), and Jupiter Price (live stats) so every token snapshot contains prices, liquidity, market-cap, and rolling stats for 1h/6h/24h.
- **Caching & paging**: Redis stores the fully merged array with a configurable TTL (default 30s). REST consumers page through the cached snapshot with cursor+limit, filtering the stats bucket (1h/6h/24h) server-side.
- **Real-time updates**: `TokenService.refreshTokens()` diff-checks the cached set; any changed tokens are emitted via Socket.IO on the `token_updates` channel while Redis is refreshed.
- **Scheduler**: `Scheduler` wires node-cron to run refresh jobs based on `ENV.DataRefreshCron`, keeping data fresh without hammering the APIs.

## Tech Stack

- Runtime: Node.js + TypeScript
- HTTP: Express
- WebSockets: Socket.IO
- Cache: Redis (`ioredis` client)
- Scheduling: `node-cron`
- HTTP clients: Axios + `axios-retry` for exponential backoff
- Tests: Vitest + Supertest

## Architecture & Design Decisions

1. **Layered services** – token fetching lives in dedicated client classes, aggregation logic in `TokenService`, persistence in `TokenCacheRepo`, and routing inside `TokenRoutes`. This separation makes mocking straightforward for the ≥10 tests.
2. **Optimistic caching** – REST never calls upstream APIs directly. Instead, paginated reads consult Redis; a cache miss triggers `refreshTokens` once, ensuring consistent snapshots per page.
3. **Stable identifiers** – tokens are keyed by address. During aggregation, we build a `Map` keyed by address so multiple upstream matches (Dex + CoinGecko + Jupiter) collapse into a single record.
4. **Stats buckets** – the response structure mirrors the requirement (time-period filters). We store all periods (`stats.h1/h6/h24`) and project the requested bucket when serving HTTP.
5. **Event-driven updates** – by diffing previous vs. refreshed snapshots we only emit WebSocket payloads for mutated tokens, minimizing client work and socket bandwidth.
6. **Resilient HTTP clients** – every client uses `axios-retry`'s exponential retry to soften transient API rate limits and slow responses.
7. **Config via env** – `jet-env` validates every required variable (port, Redis host/port, cache TTL, API keys) at boot to avoid runtime surprises. `.env.test` mirrors production defaults for deterministic tests.
8. **Testing-first** – factories and mocks allow us to cover repo, service, scheduler, and route layers. Supertest integration ensures query validation and REST outputs; Socket and cron interactions are verified with spies.

## Data Flow

1. `Scheduler.start()` runs on boot and schedules `TokenService.refreshTokens()` using `ENV.DataRefreshCron`.
2. Refresh execution:
   - Fetch recently updated token addresses from CoinGecko (filtered to alphanumerics, top 30).
   - Fetch matching data from DexScreener + Jupiter concurrently.
   - Merge into typed `Token` records (prices, liquidity, stats per time bucket).
   - Compare with cached tokens; emit diffs via Socket.IO; persist the new snapshot to Redis.
3. REST requests (`GET /api/v1/tokens`):
   - Read the cached array, optionally refresh on cache miss.
   - Slice by cursor/limit, remap stats bucket, sort by `market_cap`, `volume`, or `price_change`.
   - Return tokens plus `next_cursor` for pagination.

## API Surface

### REST

`GET /api/v1/tokens`

| Query Param      | Type   | Default     | Notes                                           |
|------------------|--------|-------------|-------------------------------------------------|
| `limit`          | number | 20          | Page size (positive integer).                   |
| `cursor`         | number | 0           | Zero-based start index.                         |
| `sort_by`        | enum   | market_cap  | `market_cap` \| `volume` \| `price_change`.     |
| `time_period`    | enum   | 1h          | `1h` \| `6h` \| `24h`; selects stats bucket.     |

Responses include `{ tokens: TokenResponse[], next_cursor: number | null }`. Invalid params return `400 { message: "Invalid query parameters" }`.

### WebSocket

- Namespace: Socket.IO default
- Event: `token_updates`
- Payload: Array of `Token` objects representing only the mutated rows since the previous broadcast.

Clients should first call the REST endpoint for an initial snapshot, then subscribe to `token_updates` for diffs.

## Testing

- 13 Vitest specs exercise caching, pagination, stats selection, diff emission, scheduler wiring, and route validation.
- Factories (`tests/factories/tokenFactory.ts`) keep fixtures deterministic, while `tests/support/setup.ts` centralizes env/log mocks.

Run locally:

```bash
pnpm install
CI=1 pnpm test
```
