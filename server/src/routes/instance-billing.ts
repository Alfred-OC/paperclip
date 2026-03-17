import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard } from "./authz.js";

export type BillingMode = "hybrid" | "subscription_only" | "api_only";

const VALID_MODES = new Set<string>(["hybrid", "subscription_only", "api_only"]);
const BILLING_PATH = path.join(os.homedir(), ".paperclip", "billing.json");

export async function readBillingMode(): Promise<BillingMode> {
  try {
    const raw = JSON.parse(await fs.readFile(BILLING_PATH, "utf-8"));
    return VALID_MODES.has(raw?.mode) ? (raw.mode as BillingMode) : "hybrid";
  } catch {
    return "hybrid";
  }
}

async function writeBillingMode(mode: BillingMode): Promise<void> {
  await fs.mkdir(path.dirname(BILLING_PATH), { recursive: true });
  await fs.writeFile(BILLING_PATH, JSON.stringify({ mode }, null, 2));
}

export function instanceBillingRoutes(_db: Db) {
  const router = Router();

  router.get("/instance/billing-mode", async (req, res) => {
    assertBoard(req);
    res.json({ mode: await readBillingMode() });
  });

  router.post("/instance/billing-mode", async (req, res) => {
    assertBoard(req);
    const mode = req.body?.mode;
    if (!VALID_MODES.has(mode)) {
      res.status(400).json({ error: `Invalid mode. Must be one of: ${[...VALID_MODES].join(", ")}` });
      return;
    }
    await writeBillingMode(mode as BillingMode);
    res.json({ mode });
  });

  return router;
}
