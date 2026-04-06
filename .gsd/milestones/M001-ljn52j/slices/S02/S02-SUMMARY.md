---
id: S02
parent: M001-ljn52j
milestone: M001-ljn52j
provides:
  - BackendConfig abstraction for dual backend support (gsd + pi)
  - Auto-detection logic (gsd first, pi fallback) with PI_ACP_PI_COMMAND override
  - Backend-specific paths: agent dir, settings, prompts, extensions, session map, skills dirs
  - Cwd-scoped session listing for gsd backend
  - Package name gsd-pi-acp reflecting dual backend support
requires:
  - slice: S01
    provides: Debug logging infrastructure for backend detection events
affects:
  - S03
  - S04
key_files:
  - src/backend/config.ts
  - src/acp/agent.ts
  - src/acp/pi-sessions.ts
  - src/pi-rpc/process.ts
  - package.json
  - README.md
key_decisions:
  - D004 pattern extended: BackendConfig getter function allows tests to override PI_ACP_PI_COMMAND at runtime
  - BackendConfig encapsulates all backend-specific paths/behavior in immutable config objects
  - Gsd uses cwd-scoped sessions (~/.gsd/sessions/<cwd-hash>/), pi uses flat sessions (~/.pi/agent/sessions/)
  - Gsd doesn't support --no-themes flag, spawnArgs omits it for gsd backend
patterns_established:
  - BackendConfig abstraction: all backend-specific paths/behavior encapsulated in immutable config objects
  - Getter function pattern (D004 extended): getBackendConfig() allows runtime env var override for tests
  - Factory functions: gsdConfig() and piConfig() create backend-specific configs with correct defaults
  - Cwd-scoped session discovery: gsd sessions in ~/.gsd/sessions/<cwd-hash>/, pi sessions flat in ~/.pi/agent/sessions/
  - Legacy function wrappers: backward-compatible functions for pi-only tests (getPiSessionsDirLegacy, listPiSessionsLegacy)
observability_surfaces:
  - Debug log events for backend detection: 'backend command: env override=...' or 'backend command: auto-detected gsd/pi'
  - Debug log events for spawn args: 'spawn args: --mode rpc' (gsd) or 'spawn args: --mode rpc --no-themes' (pi)
  - Debug log events for agent dir override: 'agent dir: env override GSD_AGENT_DIR/PI_CODING_AGENT_DIR=...'
drill_down_paths:
  - .gsd/milestones/M001-ljn52j/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S02/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S02/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S02/tasks/T04-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T18:40:21.502Z
blocker_discovered: false
---

# S02: Dual Backend Support

**Enabled dual backend support (gsd + pi) through BackendConfig abstraction with auto-detection (gsd first, pi fallback) and PI_ACP_PI_COMMAND env override, cwd-scoped sessions for gsd, and package renamed to gsd-pi-acp.**

## What Happened

**S02 Dual Backend Support** enabled the adapter to work with both `gsd --mode rpc` and `pi --mode rpc` as backends through a comprehensive BackendConfig abstraction.

**T01: BackendConfig Abstraction** — Created `src/backend/config.ts` with BackendConfig interface encapsulating all backend-specific behavior: command name, agent directory paths, settings path, prompts directory, extensions directory, session map path, skills directories, spawn args, and shell usage detection. Factory functions `gsdConfig()` and `piConfig()` create immutable config objects. Getter function `getBackendConfig()` follows D004 pattern (function not const) for runtime env var override.

**T02: Entry Point Integration** — Updated `src/index.ts` to detect backend at startup via `getBackendCommand()`, log the detected backend, and use cached command for --terminal-login flow. Updated `src/pi-rpc/command.ts` to delegate to BackendConfig for command resolution and backend detection. Added unit tests for new API.

**T03: Module Wiring** — Wired BackendConfig through all modules with hardcoded .pi paths:
- `process.ts`: Accepts config param, conditionally includes --no-themes only for pi (gsd doesn't support it)
- `paths.ts`: Backend-specific session map path (~/.gsd/session-map.json vs ~/.pi/pi-acp/session-map.json)
- `pi-settings.ts`: Backend-specific agent dir, settings path; gsd always has quietStartup=true
- `status.ts`: Backend-specific env var (GSD_AGENT_DIR vs PI_CODING_AGENT_DIR)
- `slash-commands.ts`: Backend-specific prompts directories (~/.gsd/prompts vs ~/.pi/agent/prompts)
- `pi-sessions.ts`: Cwd-scoped sessions for gsd (~/.gsd/sessions/<cwd-hash>/), flat sessions for pi
- `agent.ts`: Central orchestration with config property, passes to all dependent functions

Key behavioral differences handled: gsd doesn't support --no-themes, gsd uses ~/.gsd directly (no agent subdirectory), gsd sessions are cwd-scoped with hash format `--path-with-dashes--`.

**T04: Package Rename** — Renamed package from `pi-acp` to `gsd-pi-acp` in package.json, updated README.md with Dual Backend Support section, usage examples for PI_ACP_PI_COMMAND override, and backward compatibility notes.

**Verification**: All 70 tests pass, typecheck clean, lint clean. BackendConfig pattern enables zero-config gsd usage while maintaining pi backward compatibility.

## Verification

Slice-level verification passed:
- npm run typecheck: 0 TypeScript errors
- npm run lint: 0 ESLint errors
- npm test: 70/70 tests passing

BackendConfig abstraction:
- BackendConfig interface defined with all backend-specific paths/behavior
- Factory functions gsdConfig() and piConfig() create immutable configs
- getBackendConfig() getter function for runtime env var override (D004 pattern)
- getBackendCommand() returns {command, backend, autoDetected}

Auto-detection logic verified:
- PI_ACP_PI_COMMAND override takes precedence
- Auto-detect tries gsd first (which/where check), fallback pi
- Backend inferred from command string

Behavioral differences handled:
- gsd spawnArgs: ['--mode', 'rpc'] (no --no-themes)
- pi spawnArgs: ['--mode', 'rpc', '--no-themes']
- gsd agentDir: ~/.gsd (no 'agent' subdirectory)
- pi agentDir: ~/.pi/agent
- gsd sessions: ~/.gsd/sessions/<cwd-hash>/ (cwd-scoped)
- pi sessions: ~/.pi/agent/sessions/ (flat)

All modules wired correctly:
- process.ts accepts config param
- paths.ts getSessionMapPath(config)
- pi-settings.ts backend-specific agent dir
- pi-auth/status.ts backend-specific env var
- slash-commands.ts config.promptsDir
- pi-sessions.ts getSessionsDir(config, cwd)
- agent.ts config property + pass-through

Package renamed:
- package.json: name='gsd-pi-acp', bin={'gsd-pi-acp': 'dist/index.js'}
- README.md: Dual Backend Support section with PI_ACP_PI_COMMAND instructions

## Requirements Advanced

- R001 — BackendConfig abstraction created with factory functions for gsd and pi, auto-detection (gsd first, pi fallback), env override via PI_ACP_PI_COMMAND
- R002 — Auto-detection tries gsd first (which/where check), fallback to pi, env override via PI_ACP_PI_COMMAND
- R007 — Debug log path now backend-specific: ~/.gsd/gsd-pi-acp/debug.log for gsd, ~/.pi/pi-acp/debug.log for pi
- R012 — Package name changed to gsd-pi-acp, bin entry updated, README reflects dual backend support
- R013 — getSessionsDir(config, cwd) returns ~/.gsd/sessions/<cwd-hash>/ for gsd, listPiSessions requires cwd for gsd
- R014 — --no-themes omitted from gsd spawn args, quietStartup always true for gsd, project config reads .gsd/ not .pi/

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None. All tasks executed as planned.

## Known Limitations

None.

## Follow-ups

None. Slice goals fully achieved.

## Files Created/Modified

- `src/backend/config.ts` — Created BackendConfig interface, factory functions (gsdConfig/piConfig), auto-detection logic, helper functions
- `src/index.ts` — Added backend detection at startup, integrated getBackendCommand(), updated --terminal-login flow
- `src/pi-rpc/command.ts` — Updated to delegate to BackendConfig for command resolution and backend detection
- `src/pi-rpc/process.ts` — Added config param, conditionally includes --no-themes only for pi backend
- `src/acp/paths.ts` — Added getSessionMapPath(config) for backend-specific session map paths
- `src/acp/pi-settings.ts` — Updated getAgentDir/getEnableSkillCommands/getQuietStartup to accept BackendConfig, gsd always has quietStartup=true
- `src/pi-auth/status.ts` — Updated getPiAgentDir/hasAnyPiAuthConfigured to accept BackendConfig and appropriate agent directory
- `src/acp/slash-commands.ts` — Updated loadSlashCommands to use config.promptsDir for backend-specific prompts directories
- `src/acp/pi-sessions.ts` — Added computeCwdHash, getSessionsDir(config,cwd) for cwd-scoped gsd sessions, updated listPiSessions/findPiSessionFile to require BackendConfig
- `src/acp/session.ts` — Added config param, passes config to PiRpcProcess.spawn
- `src/acp/agent.ts` — Central orchestration: added config property, passed config to all dependent functions, buildStartupInfo uses backend-specific paths
- `package.json` — Renamed package from pi-acp to gsd-pi-acp, updated bin entry, description, URLs
- `README.md` — Updated title, added Dual Backend Support section with usage examples, updated install sections
