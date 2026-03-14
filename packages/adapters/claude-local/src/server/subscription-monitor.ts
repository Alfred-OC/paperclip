/**
 * Subscription Usage Monitor
 *
 * Tracks Claude subscription utilization to enable automatic fallback from
 * subscription billing to API-key billing when usage nears the plan limit.
 *
 * Primary: calls the claude.ai internal usage API for exact 5-hour and 7-day
 * utilization percentages (the same data shown on claude.ai/settings/usage).
 *
 * Fallback: reads Claude Code JSONL session files under ~/.claude/projects/
 * and counts input + output tokens within the 5-hour rolling window.
 *
 * Session key resolution (for the claude.ai API) — three-tier priority:
 *   1. CLAUDE_SESSION_KEY in the agent's configured env
 *   2. macOS Keychain entry "nanoclaw-claude-session" (manual override)
 *   3. Safari BinaryCookies (automatic — no config needed when logged in)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Rolling window matching Claude Code's subscription rate-limit window */
const WINDOW_MS = 5 * 60 * 60 * 1000;

/** Re-scan JSONL at most once per minute */
const CACHE_TTL_MS = 60_000;

/** Cache claude.ai API results for 5 minutes */
const API_CACHE_TTL_MS = 5 * 60 * 1000;

/** Cache Safari BinaryCookies read for 10 minutes */
const SAFARI_CACHE_TTL_MS = 10 * 60 * 1000;

const PLAN_LIMITS: Record<string, number> = {
  pro: 45_000,
  max5: 88_000,
  max20: 220_000,
};

export interface MonitorOptions {
  /** Per-5h effective token limit derived from claudePlan or tokenLimitPer5h (0 = JSONL disabled) */
  tokenLimitPer5h: number;
  /** Fraction at which to switch from subscription to API (0–1, default 0.8) */
  switchThreshold: number;
  /** claude.ai session key for the API path (from agent env CLAUDE_SESSION_KEY) */
  sessionKey?: string;
}

export function resolveMonitorOptions(config: Record<string, unknown>, env: Record<string, string>): MonitorOptions {
  const claudePlan = (typeof config.claudePlan === "string" ? config.claudePlan : "").toLowerCase();
  const explicitLimit = typeof config.tokenLimitPer5h === "number" ? config.tokenLimitPer5h : 0;
  const tokenLimitPer5h = explicitLimit > 0 ? explicitLimit : (PLAN_LIMITS[claudePlan] ?? 0);
  const switchThreshold =
    typeof config.subscriptionSwitchThreshold === "number"
      ? config.subscriptionSwitchThreshold
      : 0.8;
  const sessionKey = env["CLAUDE_SESSION_KEY"] || undefined;
  return { tokenLimitPer5h, switchThreshold, sessionKey };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  /** input + output (no cache tokens — avoids inflated counts) */
  effectiveTokens: number;
}

export interface UsageStatus {
  usage: TokenUsage;
  limit: number;
  /** Combined effective tokens / limit (0–1), or -1 when limit=0 */
  usagePercent: number;
  /** True when usage >= switchThreshold */
  isAboveThreshold: boolean;
  /** API-sourced 5h utilization (0–100), or null if API unavailable */
  fiveHourPct: number | null;
  /** API-sourced 7-day utilization (0–100), or null if API unavailable */
  sevenDayPct: number | null;
  /** ISO timestamp when 5h window resets */
  fiveHourResetsAt: string | null;
}

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, effectiveTokens: 0 };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  const u = {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    effectiveTokens: 0,
  };
  u.effectiveTokens = u.inputTokens + u.outputTokens;
  return u;
}

function parseJsonlFile(filePath: string, since: number): TokenUsage {
  const usage = emptyUsage();
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as { timestamp?: string; message?: { usage?: Record<string, number> } };
        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
        if (ts < since) continue;
        const u = entry.message?.usage;
        if (!u) continue;
        usage.inputTokens += (u["input_tokens"] as number) || 0;
        usage.outputTokens += (u["output_tokens"] as number) || 0;
        usage.cacheWriteTokens += (u["cache_creation_input_tokens"] as number) || 0;
        usage.cacheReadTokens += (u["cache_read_input_tokens"] as number) || 0;
      } catch {
        /* skip malformed lines */
      }
    }
  } catch {
    /* skip unreadable files */
  }
  usage.effectiveTokens = usage.inputTokens + usage.outputTokens;
  return usage;
}

function scanDirectory(dir: string, since: number): TokenUsage {
  let total = emptyUsage();
  if (!fs.existsSync(dir)) return total;

  function walk(d: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        total = addUsage(total, parseJsonlFile(full, since));
      }
    }
  }

  walk(dir);
  return total;
}

// ── Session key resolution ────────────────────────────────────────────────

const SAFARI_COOKIES_PATH = path.join(
  os.homedir(),
  "Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies",
);
const KEYCHAIN_SESSION_SERVICE = "nanoclaw-claude-session";

let safariSessionCache: { key: string; at: number } | null = null;

function readSafariClaudeSessionKey(): string | null {
  let data: Buffer;
  try {
    data = fs.readFileSync(SAFARI_COOKIES_PATH);
  } catch {
    return null;
  }

  if (data.length < 8 || data.subarray(0, 4).toString("ascii") !== "cook") return null;

  const numPages = data.readUInt32BE(4);
  let dataOffset = 8;
  const pageSizes: number[] = [];
  for (let i = 0; i < numPages; i++) {
    pageSizes.push(data.readUInt32BE(dataOffset));
    dataOffset += 4;
  }

  for (const pageSize of pageSizes) {
    const page = data.subarray(dataOffset, dataOffset + pageSize);
    dataOffset += pageSize;
    if (page.length < 8) continue;

    const numCookies = page.readUInt32LE(4);
    for (let i = 0; i < numCookies; i++) {
      const co = page.readUInt32LE(8 + i * 4);
      if (co + 56 > page.length) continue;
      const cookieSize = page.readUInt32LE(co);
      if (co + cookieSize > page.length) continue;

      const domainOff = page.readUInt32LE(co + 16);
      const nameOff = page.readUInt32LE(co + 20);
      const valueOff = page.readUInt32LE(co + 28);

      const readStr = (relOff: number): string => {
        const start = co + relOff;
        const nullIdx = page.indexOf(0, start);
        return page.subarray(start, nullIdx < 0 ? co + cookieSize : nullIdx).toString("utf8");
      };

      if (readStr(domainOff).includes("claude.ai") && readStr(nameOff) === "sessionKey") {
        return readStr(valueOff);
      }
    }
  }
  return null;
}

function resolveSessionKey(envSessionKey?: string): string | null {
  // 1. Agent env override
  if (envSessionKey) return envSessionKey;

  // 2. Keychain manual override (reuses nanoclaw's service name for convenience)
  try {
    const key = execSync(`security find-generic-password -s "${KEYCHAIN_SESSION_SERVICE}" -w`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5_000,
    }).toString().trim();
    if (key) return key;
  } catch { /* not stored */ }

  // 3. Safari BinaryCookies (cached 10 min)
  const now = Date.now();
  if (safariSessionCache && now - safariSessionCache.at < SAFARI_CACHE_TTL_MS) {
    return safariSessionCache.key;
  }
  const key = readSafariClaudeSessionKey();
  if (key) {
    safariSessionCache = { key, at: now };
    return key;
  }

  return null;
}

// ── claude.ai usage API ───────────────────────────────────────────────────

interface ApiUsageResult {
  fiveHourPct: number;
  sevenDayPct: number;
  fiveHourResetsAt: string | null;
}

const API_HEADERS = {
  "anthropic-client-platform": "web_claude_ai",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
  "origin": "https://claude.ai",
  "referer": "https://claude.ai/settings/usage",
};

let apiCached: { result: ApiUsageResult | null; at: number } | null = null;
let cachedOrgUuid: string | null = null;

async function fetchClaudeAiUsage(sessionKey: string): Promise<ApiUsageResult | null> {
  const now = Date.now();
  if (apiCached && now - apiCached.at < API_CACHE_TTL_MS) return apiCached.result;

  const headers = { ...API_HEADERS, Cookie: `sessionKey=${sessionKey}` };

  try {
    if (!cachedOrgUuid) {
      const orgsRes = await fetch("https://claude.ai/api/organizations", { headers });
      if (!orgsRes.ok) {
        if (orgsRes.status === 401) cachedOrgUuid = null;
        apiCached = { result: null, at: now };
        return null;
      }
      const orgs = await orgsRes.json() as Array<{ uuid: string }>;
      if (!Array.isArray(orgs) || !orgs[0]?.uuid) {
        apiCached = { result: null, at: now };
        return null;
      }
      cachedOrgUuid = orgs[0].uuid;
    }

    const usageRes = await fetch(`https://claude.ai/api/organizations/${cachedOrgUuid}/usage`, { headers });
    if (!usageRes.ok) {
      if (usageRes.status === 401) cachedOrgUuid = null;
      apiCached = { result: null, at: now };
      return null;
    }

    const body = await usageRes.json() as {
      five_hour?: { utilization?: number; resets_at?: string };
      seven_day?: { utilization?: number; resets_at?: string };
    };

    const result: ApiUsageResult = {
      fiveHourPct: body.five_hour?.utilization ?? 0,
      sevenDayPct: body.seven_day?.utilization ?? 0,
      fiveHourResetsAt: body.five_hour?.resets_at ?? null,
    };

    console.info(
      `[subscription-monitor] claude.ai API: 5h=${result.fiveHourPct}% 7d=${result.sevenDayPct}% resetsAt=${result.fiveHourResetsAt}`,
    );

    apiCached = { result, at: now };
    return result;
  } catch {
    apiCached = { result: null, at: now };
    return null;
  }
}

// ── Main cache + getUsageStatus ───────────────────────────────────────────

let cached: { status: UsageStatus; at: number } | null = null;

export function invalidateUsageCache(): void {
  cached = null;
  apiCached = null;
}

export async function getUsageStatus(opts: MonitorOptions): Promise<UsageStatus> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.status;

  const since = now - WINDOW_MS;
  const usage = scanDirectory(path.join(os.homedir(), ".claude", "projects"), since);

  const usagePercent = opts.tokenLimitPer5h > 0 ? usage.effectiveTokens / opts.tokenLimitPer5h : -1;

  const sessionKey = resolveSessionKey(opts.sessionKey);
  const apiUsage = sessionKey ? await fetchClaudeAiUsage(sessionKey) : null;

  const effectivePct = apiUsage !== null
    ? Math.max(apiUsage.fiveHourPct, apiUsage.sevenDayPct) / 100
    : usagePercent;

  const status: UsageStatus = {
    usage,
    limit: opts.tokenLimitPer5h,
    usagePercent: apiUsage !== null ? apiUsage.fiveHourPct / 100 : usagePercent,
    isAboveThreshold: effectivePct >= opts.switchThreshold,
    fiveHourPct: apiUsage?.fiveHourPct ?? null,
    sevenDayPct: apiUsage?.sevenDayPct ?? null,
    fiveHourResetsAt: apiUsage?.fiveHourResetsAt ?? null,
  };

  if (apiUsage === null && opts.tokenLimitPer5h > 0) {
    console.debug(
      `[subscription-monitor] JSONL fallback: effective=${usage.effectiveTokens} limit=${opts.tokenLimitPer5h} usage=${Math.round(usagePercent * 100)}% above=${status.isAboveThreshold}`,
    );
  }

  cached = { status, at: now };
  return status;
}
