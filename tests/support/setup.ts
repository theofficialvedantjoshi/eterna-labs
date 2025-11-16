import { afterEach, beforeAll, vi } from "vitest";

vi.mock("jet-logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    err: vi.fn(),
    imp: vi.fn(),
    silly: vi.fn(),
    crit: vi.fn(),
    debug: vi.fn(),
  },
}));

beforeAll(() => {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
