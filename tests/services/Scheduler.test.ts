import { describe, it, expect, beforeEach, vi } from "vitest";
import { Scheduler } from "@src/services/Scheduler";
import ENV from "@src/common/constants/ENV";
import type { TokenService } from "@src/services/TokenService";

const cronMocks = vi.hoisted(() => ({
  scheduleMock: vi.fn(),
}));

vi.mock("node-cron", () => ({
  default: {
    schedule: cronMocks.scheduleMock,
  },
}));

describe("Scheduler", () => {
  beforeEach(() => {
    cronMocks.scheduleMock.mockReset();
  });

  it("wires the cron schedule and triggers refresh", async () => {
    const refreshTokens = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({
      refreshTokens,
    } as unknown as TokenService);

    scheduler.start();

    expect(cronMocks.scheduleMock).toHaveBeenCalledWith(
      ENV.DataRefreshCron,
      expect.any(Function)
    );
    const [, handler] = cronMocks.scheduleMock.mock.calls[0] as [
      string,
      () => Promise<void>
    ];
    await handler();
    expect(refreshTokens).toHaveBeenCalled();
  });

  it("logs errors when scheduled refresh fails", async () => {
    const refreshTokens = vi.fn().mockRejectedValue(new Error("boom"));
    const scheduler = new Scheduler({
      refreshTokens,
    } as unknown as TokenService);
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduler.start();
    const [, handler] = cronMocks.scheduleMock.mock.calls[0] as [
      string,
      () => Promise<void>
    ];
    await handler();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
