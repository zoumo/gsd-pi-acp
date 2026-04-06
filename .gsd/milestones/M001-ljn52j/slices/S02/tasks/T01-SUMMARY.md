---
id: T01
parent: S02
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/backend/config.ts"]
key_decisions: ["D004 pattern applied: getter function for backend config (not const) allows tests to override PI_ACP_PI_COMMAND env var at runtime"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npm run typecheck passed with zero TypeScript errors. grep -c 'BackendConfig' src/backend/config.ts returned 6 occurrences (>= 5 required by task plan). BackendConfig interface, factory functions, and getter functions all compile correctly."
completed_at: 2026-04-02T17:55:29.440Z
blocker_discovered: false
---

# T01: Created BackendConfig type in src/backend/config.ts with factory functions for gsd and pi backends, auto-detection (gsd first, pi fallback), and env override via PI_ACP_PI_COMMAND.

> Created BackendConfig type in src/backend/config.ts with factory functions for gsd and pi backends, auto-detection (gsd first, pi fallback), and env override via PI_ACP_PI_COMMAND.

## What Happened
---
id: T01
parent: S02
milestone: M001-ljn52j
key_files:
  - src/backend/config.ts
key_decisions:
  - D004 pattern applied: getter function for backend config (not const) allows tests to override PI_ACP_PI_COMMAND env var at runtime
duration: ""
verification_result: passed
completed_at: 2026-04-02T17:55:29.442Z
blocker_discovered: false
---

# T01: Created BackendConfig type in src/backend/config.ts with factory functions for gsd and pi backends, auto-detection (gsd first, pi fallback), and env override via PI_ACP_PI_COMMAND.

**Created BackendConfig type in src/backend/config.ts with factory functions for gsd and pi backends, auto-detection (gsd first, pi fallback), and env override via PI_ACP_PI_COMMAND.**

## What Happened

Implemented the BackendConfig abstraction as the foundation for dual backend support. Created src/backend/config.ts with:

1. **BackendConfig interface**: Encapsulates all backend-specific behavior including backend name, default command (platform-specific), agent directory paths, settings path, prompts dir, extensions dir, session map path, skills directories, spawn args, and shell usage detection.

2. **Factory functions**: gsdConfig() and piConfig() create immutable BackendConfig objects with correct paths for each backend. Key differences:
   - gsd uses ~/.gsd directly as agent dir (no 'agent' subdirectory)
   - pi uses ~/.pi/agent as agent dir
   - Session map path: ~/.gsd/session-map.json for gsd, ~/.pi/pi-acp/session-map.json for pi
   - Skills directories differ: gsd has ~/.gsd/skills + project .gsd/skills, pi has ~/.pi/agent/skills + ~/.agents/skills + project .pi/skills

3. **Runtime detection**: getBackendConfig() getter function follows D004 pattern (getter instead of const) allowing tests to override env vars at runtime. Resolution order: PI_ACP_PI_COMMAND env var if set (explicit override, backend inferred from command), then auto-detect (try gsd first, fallback to pi).

4. **Helper functions**: getBackendCommand() returns command/backend/autoDetected, resolveAgentDir() handles env var override, getSpawnArgs() builds spawn args with optional session path.

All verification checks passed: TypeScript compilation clean, BackendConfig grep count = 6 (>= 5 required).

## Verification

npm run typecheck passed with zero TypeScript errors. grep -c 'BackendConfig' src/backend/config.ts returned 6 occurrences (>= 5 required by task plan). BackendConfig interface, factory functions, and getter functions all compile correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 3000ms |
| 2 | `grep -c 'BackendConfig' src/backend/config.ts` | 0 | ✅ pass | 500ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/backend/config.ts`


## Deviations
None.

## Known Issues
None.
