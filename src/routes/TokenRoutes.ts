// src/routes/TokenRoutes.ts
import { Router } from "express";
import { TokenService } from "@src/services/TokenService";
import { sorts, timePeriods } from "@src/models/Token";

export const createTokenRoutes = (tokenService: TokenService): Router => {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const cursor = req.query.cursor ? Number(req.query.cursor) : 0;
      const sortBy = (req.query.sort_by as string) || "market_cap";
      const timePeriod = (req.query.time_period as string) || "1h";
      console.log("Received GET /tokens with params:", {
        limit,
        cursor,
        sortBy,
        timePeriod,
      });

      if (
        !sorts.includes(sortBy) ||
        !timePeriods.includes(timePeriod) ||
        limit <= 0 ||
        cursor < 0 ||
        Number.isNaN(limit) ||
        Number.isNaN(cursor)
      ) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      const data = await tokenService.getPaginatedTokens(
        limit,
        cursor,
        sortBy,
        timePeriod
      );
      res.json(data);
    } catch (error) {
      console.error("Error in GET /tokens:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
};
