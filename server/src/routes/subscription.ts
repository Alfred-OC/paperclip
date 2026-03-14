import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { getUsageStatus, resolveMonitorOptions } from "@paperclipai/adapter-claude-local/server";
import { assertBoard } from "./authz.js";

export function subscriptionRoutes(_db: Db) {
  const router = Router();

  router.get("/subscription/status", async (req, res) => {
    assertBoard(req);

    const env = process.env as Record<string, string>;
    const config: Record<string, unknown> = {
      claudePlan: env["CLAUDE_PLAN"] ?? "pro",
      subscriptionSwitchThreshold: env["SUBSCRIPTION_SWITCH_THRESHOLD"]
        ? parseFloat(env["SUBSCRIPTION_SWITCH_THRESHOLD"])
        : 0.8,
    };
    const opts = resolveMonitorOptions(config, env);

    try {
      const status = await getUsageStatus(opts);
      const source =
        status.fiveHourPct !== null ? "api" : opts.tokenLimitPer5h > 0 ? "jsonl" : "none";
      res.json({
        fiveHourPct: status.fiveHourPct,
        sevenDayPct: status.sevenDayPct,
        usagePercent: status.usagePercent,
        isAboveThreshold: status.isAboveThreshold,
        fiveHourResetsAt: status.fiveHourResetsAt,
        source,
      });
    } catch {
      res.json({
        fiveHourPct: null,
        sevenDayPct: null,
        usagePercent: -1,
        isAboveThreshold: false,
        fiveHourResetsAt: null,
        source: "none",
      });
    }
  });

  return router;
}
