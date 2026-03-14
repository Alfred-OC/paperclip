export const type = "claude_local";
export const label = "Claude Code (local)";

export const models = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-6", label: "Claude Haiku 4.6" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export const agentConfigurationDoc = `# claude_local agent configuration

Adapter: claude_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, optional): Claude model id
- effort (string, optional): reasoning effort passed via --effort (low|medium|high)
- chrome (boolean, optional): pass --chrome when running Claude
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to claude
- command (string, optional): defaults to "claude"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Claude starts and exposed back via context/env

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Subscription / billing fields:
- claudePlan (string, optional: "pro" | "max5" | "max20"): Claude subscription plan used for JSONL-based token limit calculation (pro=45k, max5=88k, max20=220k tokens/5h)
- tokenLimitPer5h (number, optional): explicit per-5h token limit; overrides claudePlan
- subscriptionSwitchThreshold (number, optional, default 0.8): fraction (0–1) of the 5h token limit at which to switch from subscription billing to API-key billing

Bitwarden Secrets Manager (BWS) fields — configure in env:
- BWS_ACCESS_TOKEN (string, secret ref): Bitwarden Secrets Manager access token; when present, all BWS secrets are automatically injected into the agent subprocess env (existing env values take precedence)
- BWS_PROJECT_ID (string, optional, secret ref): scopes BWS fetch to a specific project

Usage monitoring env fields (configure in env):
- ANTHROPIC_API_KEY (string, secret ref): API-key fallback; withheld from the subprocess when subscription usage is below subscriptionSwitchThreshold, injected when above it
- CLAUDE_SESSION_KEY (string, optional, secret ref): claude.ai web session cookie for the usage monitoring API (provides exact 5h/7d utilization); if omitted the monitor reads from Safari BinaryCookies automatically or falls back to JSONL token counting

Notes:
- When Paperclip realizes a workspace/runtime for a run, it injects PAPERCLIP_WORKSPACE_* and PAPERCLIP_RUNTIME_* env vars for agent-side tooling.
- Subscription monitoring requires claude login to have been run once so the claude CLI subprocess can use the existing macOS Keychain credentials.
`;
