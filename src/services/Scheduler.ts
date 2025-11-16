import cron from "node-cron";
import { TokenService } from "@src/services/TokenService";
import ENV from "@src/common/constants/ENV";

export class Scheduler {
  private tokenService: TokenService;

  constructor(tokenService: TokenService) {
    this.tokenService = tokenService;
  }

  public start(): void {
    console.log("Starting scheduler...");
    cron.schedule(ENV.DataRefreshCron, () => {
      this.tokenService.refreshTokens().catch((err:unknown) => {
        console.error("Error refreshing tokens in scheduled job:", err);
      });
    });
  }
}
