import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard } from "./authz.js";

const PLIST_LABEL = "com.paperclipai.paperclip";
const PLIST_PATH = path.join(os.homedir(), "Library", "LaunchAgents", `${PLIST_LABEL}.plist`);

function buildPlist(): string {
  const nodeBin = process.execPath;
  const scriptPath = process.argv[1];
  const logsDir = path.join(os.homedir(), ".paperclip", "logs");
  fs.mkdirSync(logsDir, { recursive: true });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${scriptPath}</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logsDir}/paperclip.log</string>
  <key>StandardErrorPath</key>
  <string>${logsDir}/paperclip.error.log</string>
</dict>
</plist>
`;
}

export function instanceStartupRoutes(_db: Db) {
  const router = Router();

  router.get("/instance/startup", (req, res) => {
    assertBoard(req);
    const isDarwin = os.platform() === "darwin";
    const enabled = isDarwin && fs.existsSync(PLIST_PATH);
    res.json({ enabled, isDarwin, plistPath: PLIST_PATH });
  });

  router.post("/instance/startup", (req, res) => {
    assertBoard(req);
    const isDarwin = os.platform() === "darwin";
    if (!isDarwin) {
      res.status(400).json({ error: "Launch on login is only supported on macOS" });
      return;
    }

    const enabled: boolean = Boolean(req.body.enabled);
    try {
      if (enabled) {
        fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });
        fs.writeFileSync(PLIST_PATH, buildPlist());
        execFileSync("launchctl", ["load", "-w", PLIST_PATH]);
      } else {
        if (fs.existsSync(PLIST_PATH)) {
          try { execFileSync("launchctl", ["unload", "-w", PLIST_PATH]); } catch { /* already unloaded */ }
          fs.rmSync(PLIST_PATH);
        }
      }
      res.json({ enabled, plistPath: PLIST_PATH });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to configure startup" });
    }
  });

  return router;
}
