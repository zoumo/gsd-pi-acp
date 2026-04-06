# S02: Dual Backend Support — Research

**Date:** 2026-04-03

## Summary

Slice S02 implements dual backend support, enabling the adapter to work with both `gsd --mode rpc` and `pi --mode rpc` as backends. The current codebase is hardcoded for pi only — paths, env vars, spawn args, and config locations all assume `.pi/` prefix. The slice requires: (1) backend auto-detection (try gsd first, fallback to pi), (2) backend-specific paths and env vars, (3) cwd-scoped session listing (O(cwd) not O(all)), (4) backend-specific spawn args (--no-themes only for pi), (5) package rename to `gsd-pi-acp`.

**Primary recommendation:** Create a `BackendConfig` abstraction that encapsulates all backend-specific behavior (command name, agent directory, config paths, env var name, spawn args). Pass this config through the system via dependency injection rather than hardcoding paths. This avoids scattering `if (isGsd)` checks throughout the codebase and keeps the backend abstraction centralized.

## Recommendation

**Create a BackendConfig abstraction layer** that encapsulates all backend-specific differences. The adapter should:

1. Detect backend at startup (index.ts) — check PI_ACP_PI_COMMAND override, else try `gsd` first, fallback to `pi`
2. Create BackendConfig instance based on detected backend
3. Pass BackendConfig to all components that need backend-specific behavior

This approach is preferred over scattering `if (isGsd)` checks because:
- Centralizes backend knowledge in one place
- Makes future backend additions easier (just add a new BackendConfig variant)
- Avoids duplicated path construction logic
- Keeps tests clean (can mock BackendConfig)

## Implementation Landscape

### Key Files

- `src/pi-rpc/command.ts` — Current backend command resolution (hardcoded to `pi`/`pi.cmd`). Needs gsd detection and fallback logic.
- `src/pi-rpc/process.ts` — Spawn implementation with hardcoded `['--mode', 'rpc', '--no-themes']` args. Gsd doesn't support `--no-themes`.
- `src/acp/paths.ts` — Session map path hardcoded to `~/.pi/pi-acp/session-map.json`. Needs backend-specific path.
- `src/acp/pi-settings.ts` — Agent dir, settings path, quietStartup all hardcoded to `.pi`. Needs backend-specific paths and always-true quietStartup for gsd.
- `src/acp/pi-sessions.ts` — Session listing walks ALL directories under `~/.pi/agent/sessions/`. Needs cwd-scoped scanning (only `~/.gsd/sessions/<cwd-hash>/` for gsd).
- `src/pi-auth/status.ts` — Auth detection uses `PI_CODING_AGENT_DIR` env var. Gsd uses `GSD_CODING_AGENT_DIR`.
- `src/acp/slash-commands.ts` — Prompts directory hardcoded to `~/.pi/agent/prompts` and `.pi/prompts`. Needs `.gsd/` equivalent.
- `src/acp/agent.ts` — Skills, extensions, settings paths all hardcoded to `.pi`. Also uses pi-specific startup info logic.
- `src/index.ts` — Entry point that spawns backend. Needs backend detection before creating agent.
- `package.json` — Package name `pi-acp`, bin `pi-acp`. Needs rename to `gsd-pi-acp`.
- `README.md` — Documentation mentions only pi. Needs gsd mention and dual-backend instructions.

### Backend Differences

| Aspect | pi | gsd |
|--------|----|----|
| Command | `pi` / `pi.cmd` | `gsd` |
| Env var for agent dir | `PI_CODING_AGENT_DIR` | `GSD_CODING_AGENT_DIR` |
| Agent directory | `~/.pi/agent/` | `~/.gsd/agent/` |
| Sessions directory | `~/.pi/agent/sessions/` | `~/.gsd/sessions/` |
| Project config | `.pi/settings.json` | `.gsd/settings.json` |
| Project prompts | `.pi/prompts/` | `.gsd/prompts/` |
| Project skills | `.pi/skills/` | `.gsd/skills/` |
| Spawn args | `['--mode', 'rpc', '--no-themes']` | `['--mode', 'rpc']` (no `--no-themes`) |
| quietStartup | Read from settings | Always true |
| Session format | JSONL, version 3 | Same (identical) |
| Session cwd hash | `--<path-with-dashes>--` | Same (identical) |

### Session Directory Hash

Both pi and gsd use the same cwd hash format: `--<path-with-slashes-replaced-by-dashes>--`.

Example: cwd `/Users/jim/code/zoumo/gsd-pi-acp` → hash `--Users-jim-code-zoumo-gsd-pi-acp--`

Session files are stored in: `~/<backend>/sessions/<cwd-hash>/<timestamp>_<uuid>.jsonl`

### Current Session Listing Problem

`listPiSessions()` in `pi-sessions.ts` uses `walkJsonlFiles()` to recursively walk ALL subdirectories under `~/.pi/agent/sessions/`. This is O(all sessions globally), then filters in-memory by cwd.

For R013 (cwd-scoped scanning), we need:
1. Compute cwd hash from effective cwd
2. Only scan that specific directory: `~/<backend>/sessions/<cwd-hash>/`
3. This is O(cwd sessions only) — much faster for users with many projects

### Build Order

1. **BackendConfig abstraction (T01)** — Create `src/backend/config.ts` with BackendConfig type and factory functions for gsd/pi. This unblocks all downstream changes.

2. **Backend detection in index.ts (T02)** — Modify `src/index.ts` and `src/pi-rpc/command.ts` to detect backend (PI_ACP_PI_COMMAND override → try gsd → fallback pi). Unblocks process.ts spawn args.

3. **Backend-specific spawn args (T03)** — Modify `src/pi-rpc/process.ts` to accept BackendConfig and conditionally include `--no-themes`.

4. **Backend-specific paths (T04)** — Modify `src/acp/paths.ts`, `src/acp/pi-settings.ts`, `src/pi-auth/status.ts`, `src/acp/slash-commands.ts` to use BackendConfig for agent dir, config paths, env var name.

5. **cwd-scoped session listing (T05)** — Modify `src/acp/pi-sessions.ts` to accept BackendConfig and only scan cwd-specific directory.

6. **Agent.ts integration (T06)** — Modify `src/acp/agent.ts` to pass BackendConfig through, use backend-specific paths for skills/extensions/settings, handle gsd quietStartup=always.

7. **Package rename (T07)** — Modify `package.json` (name, bin) and `README.md` for gsd-pi-acp.

### Verification Approach

**Manual verification (primary):**
1. Set `PI_ACP_PI_COMMAND=gsd`, connect from Zed, send prompt, verify response
2. Clear env var, verify pi backend still works
3. Check session files persist in correct directory structure (`~/.gsd/sessions/<cwd-hash>/` vs `~/.pi/agent/sessions/<cwd-hash>/`)
4. Verify cwd-scoped session listing (listSessions returns only cwd sessions)

**Automated tests:**
- Extend existing session tests to test both backends (mock BackendConfig)
- Add test for backend detection logic (gsd first, pi fallback)
- Add test for cwd-scoped session listing

**Commands:**
```bash
# Type check
npm run typecheck

# Lint
npm run lint

# All tests
npm test

# Manual test with gsd
PI_ACP_PI_COMMAND=gsd node dist/index.js
# Then send ACP initialize request via stdio

# Manual test with pi (fallback)
node dist/index.js
# Should auto-detect pi if gsd not found
```

## Constraints

- **No breaking changes to pi backend** — Existing pi users must see no behavioral changes when PI_ACP_PI_COMMAND is unset or set to `pi`. This means the fallback logic must correctly detect pi.

- **Same session format** — Both backends use identical JSONL session format (type: "session", version: 3, id, timestamp, cwd). No translation needed.

- **Auth detection works for both** — Both use `auth.json`, `models.json`, and same env vars (OPENAI_API_KEY, etc.) for auth. Only the agent directory path differs.

- **GSD_CODING_AGENT_DIR env var** — Gsd uses `GSD_CODING_AGENT_DIR` for agent dir override, not `PI_CODING_AGENT_DIR`. This follows the pattern `${APP_NAME.toUpperCase()}_CODING_AGENT_DIR` from pi-mono codebase.

- **--no-themes not supported by gsd** — Spawning gsd with `--no-themes` causes an error. Must conditionally include this arg only for pi.

## Common Pitfalls

- **Hardcoded .pi paths** — Many files have hardcoded `.pi` in path strings. Must check all files systematically (use `rg '\.pi' --type ts`).

- **PI_CODING_AGENT_DIR vs GSD_CODING_AGENT_DIR** — The env var names differ by backend. Don't assume PI_CODING_AGENT_DIR works for gsd.

- **Session map path** — Currently `~/.pi/pi-acp/session-map.json`. For gsd should be `~/.gsd/gsd-pi-acp/session-map.json` (matching package name).

- **Double-check all path references** — Run `rg 'homedir.*\.pi' --type ts` and `rg 'join.*\.pi' --type ts` to find all hardcoded agent paths.

- **cwd hash computation** — The hash format is `--<path-with-slashes-replaced-by-dashes>--`. Verify this matches actual gsd/pi behavior before implementing.

## Open Risks

- **Backend detection edge cases** — What if neither gsd nor pi is on PATH? Should throw a clear error like PiRpcSpawnError. Current code already handles ENOENT.

- **Multiple backend versions** — User might have both gsd and pi installed but want to use pi. PI_ACP_PI_COMMAND override handles this.

- **Session migration** — Users switching from pi to gsd might have existing sessions in ~/.pi/agent/sessions/. These won't be visible to gsd backend. This is expected behavior (separate session pools).

## Forward Intelligence (from S01)

S01 established patterns that S02 should follow:

1. **Getter functions for env-configurable constants** — Use `getMaxQueueDepth()` pattern (function, not const) so tests can override env vars at runtime. Apply to backend detection if needed.

2. **Fire-and-forget async logging** — Use debugLog() from `src/logger.ts` for backend detection events (which backend detected, spawn args, agent dir path).

3. **Direct instance capture for disposal** — S01 fixed unsafe `(agent as any)?.agent?.dispose?.()` pattern. S02 should follow this pattern if adding new dispose logic.

4. **Timeout wrapper pattern** — If backend detection needs to timeout (e.g., trying to spawn gsd to verify it exists), use settled boolean guard + wrapper functions pattern from S01.

5. **Debug log file location** — Default path is `~/.gsd/gsd-pi-acp/debug.log` (already set in S01 for gsd primary use case).