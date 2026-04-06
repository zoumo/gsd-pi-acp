# gsd-pi-acp (ACP adapter for gsd/pi coding agents)

ACP adapter that bridges **ACP JSON-RPC 2.0 over stdio** (for clients like Zed) to **gsd/pi --mode rpc** subprocesses via newline-delimited JSON.

## Architecture

```
src/
├── index.ts                    # Entry: stdio transport, signal handling, graceful shutdown
├── logger.ts                   # Fire-and-forget debug logger (PI_ACP_DEBUG_LOG)
├── backend/config.ts           # Backend detection (gsd-first, pi fallback, or explicit)
├── acp/
│   ├── agent.ts                # ACP protocol handler (initialize, newSession, prompt, etc.)
│   ├── session.ts              # Session lifecycle + event translation + turn queue
│   ├── session-lifecycle.ts    # Session start/stop orchestration
│   ├── session-store.ts        # JSON file persistence
│   ├── paths.ts                # Directory resolution (backend-aware)
│   ├── pi-sessions.ts          # Filesystem session scanning
│   ├── pi-settings.ts          # Config merge (global + project settings)
│   ├── pi-commands.ts          # get_commands -> ACP tool conversion
│   ├── slash-commands.ts       # Slash command file template loading
│   ├── slash-command-dispatcher.ts  # Slash command expansion
│   ├── builtin-commands.ts     # Built-in command definitions
│   ├── startup-info.ts         # Agent startup metadata
│   ├── model-utils.ts          # Model selection helpers
│   ├── pkg-utils.ts            # Package.json utilities
│   ├── auth.ts / auth-required.ts  # Authentication flow
│   └── translate/              # Message/tool/prompt translation layer
└── pi-rpc/
    ├── process.ts              # Subprocess management + NDJSON RPC (with timeout, dispose)
    ├── command.ts              # Executable resolution (gsd/pi, platform-aware)
    └── schemas.ts              # Zod schemas for RPC response validation
```

### Key design decisions

- **1 ACP session = 1 subprocess**: pi RPC mode is single-session
- **Dual backend**: auto-detects gsd, falls back to pi, or explicit via `PI_ACP_PI_COMMAND`
- **RPC timeout**: 30s default, configurable via `PI_ACP_RPC_TIMEOUT_MS`
- **Turn queue**: bounded depth (default 3), prevents unbounded memory growth
- **No ACP client-side FS/terminal delegation**: pi already reads/writes locally

## Dev workflow

```bash
npm install          # Install deps
npm run build        # Build
npm run dev          # Dev mode
npm run test         # Run tests
npm run lint         # Lint
```

## Coding guidelines

- Keep ACP protocol handling in `src/acp/`, RPC subprocess logic in `src/pi-rpc/`
- Prefer small translation functions with unit tests
- Be strict about streaming and process cleanup (handle exit, drain stdout/stderr, timeouts)
- Avoid unnecessary comments; only explain non-obvious decisions
- Avoid `any`; prefer explicit types. Only use `any` for untyped external data
- **DO NOT** commit unless explicitly asked

## Documentation conventions

### What goes where

| Location | Content | Lifecycle |
|----------|---------|-----------|
| `docs/` | **Living references** — documents maintained alongside the code (e.g. ACP compliance matrix, architecture overview, dev guide) | Updated when code changes invalidate them |
| `.gsd/` | **Project management** — roadmaps, plans, summaries, requirements, decisions | Managed by GSD workflow |
| Code + git history | Implementation details, audit findings, code reviews | Permanent record |

### Rules

- `docs/` only contains **active, maintained** documents. If a doc will not be updated as the code evolves, it does not belong in `docs/`.
- **Audit reports, code reviews, and one-off analysis** are ephemeral artifacts. Do not commit them to `docs/`. Their value is captured in the code changes they produced; the originals live in git history or `.gsd/` slice artifacts.
- **Point-in-time snapshots** (architecture diagrams of old state, coverage reports, migration checklists) should be deleted once the work they describe is complete.
- When a milestone completes, review `docs/` and remove anything that no longer reflects current code.
- Prefer updating an existing doc over creating a new one.

### Current docs

- `docs/acp-compliance.md` — ACP protocol compliance matrix (methods, capabilities, gaps)

## Client information

- Primary ACP client: Zed editor

## References

- Local ACP repo: `~/Dev/learning/agent-client-protocol`
- Local Zed repo: `~/Dev/learning/zed/zed`
