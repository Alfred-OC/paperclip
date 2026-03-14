# Skill: Gemini CLI — Large-Context & Parallel AI Tasks

**Binary:** `gemini` (installed globally, available in PATH)
**Model:** Gemini 3 Flash / Pro (2M token context window — ~10× larger than Claude Pro)
**Auth:** reads `GEMINI_API_KEY` from environment (already injected by NanoClaw)

---

## When to Use Gemini CLI

Use `gemini` from Bash when:
- A task requires reading very large codebases (>100k tokens) that would exceed Claude's window
- You want to run a second AI pass in parallel without using your own context budget
- You need Gemini's multimodal capabilities (images + text in the same prompt)
- You want a second opinion or code review from a different model

**Complementary use:** Claude handles orchestration and decision-making; Gemini handles large-context ingestion, bulk code generation, or independent parallel sub-tasks.

---

## Non-Interactive Usage

```bash
# Simple prompt
gemini -p "Summarise this file in 3 bullets" -m gemini-3-flash

# Pipe file content
cat /workspace/group/bigfile.ts | gemini -p "Find all security vulnerabilities" -m gemini-3-pro

# Read entire directory and ask a question
gemini -p "Explain the architecture of this Next.js app" \
       --include-directories /workspace/projects/myapp/src \
       -m gemini-3-pro

# Get JSON output
gemini -p "Return a JSON array of all API endpoints" \
       --output-format json \
       -m gemini-3-pro
```

**Flags:**
| Flag | Description |
|------|-------------|
| `-p "..."` | Prompt text (required for non-interactive use) |
| `-m model` | Model: `gemini-3-pro`, `gemini-3-flash`, `gemini-3-flash` |
| `--output-format json` | Return structured JSON (easier to parse) |
| `--include-directories path` | Include all files in directory as context |

---

## Practical Patterns

### Large codebase analysis
```bash
# Analyse an entire project too big for Claude's context
find /workspace/projects/myapp -name "*.ts" -o -name "*.tsx" | \
  xargs cat | \
  gemini -p "List all components that make API calls and what endpoints they hit" \
         -m gemini-3-pro
```

### Generate then review
```bash
# Step 1: Claude generates code
# Step 2: Gemini reviews it
gemini -p "$(cat <<'EOF'
Review this TypeScript code for bugs, type errors, and security issues.
Return JSON: {"issues": [{"line": N, "severity": "error|warning", "description": "..."}]}

$(cat /workspace/projects/myapp/lib/auth.ts)
EOF
)" --output-format json -m gemini-3-pro
```

### Parallel sub-tasks (fire and collect)
```bash
# Run two Gemini tasks in background simultaneously
gemini -p "Write unit tests for: $(cat auth.ts)" -m gemini-3-flash > /tmp/tests.txt &
gemini -p "Write JSDoc for: $(cat auth.ts)" -m gemini-3-flash > /tmp/docs.txt &
wait  # Wait for both to complete
cat /tmp/tests.txt
cat /tmp/docs.txt
```

---

## Model Selection

| Model | Use for |
|-------|---------|
| `gemini-3-pro` | Complex reasoning, architecture decisions, code review |
| `gemini-3-flash` | Fast generation, bulk tasks, simple transforms, default choice |

---

## Notes

- `GEMINI_API_KEY` is injected automatically — no auth setup needed
- For interactive sessions (REPL), just run `gemini` with no flags — but prefer `-p` for automation
- Gemini CLI can also use MCP tools — see `gemini --help` for MCP integration options
- Output goes to stdout; capture with `$(...)` or redirect to file
