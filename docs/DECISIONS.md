# Architecture Decisions

> Auto-generated from GSD decision register. Do not edit directly.
> Last synced: 2026-04-07 (M003/S03)

## Active Decisions

### D001: BackendConfig abstraction pattern

- **When:** —
- **Choice:** BackendConfig interface + factory functions (gsdConfig/piConfig) + getter function (getBackendConfig) for runtime env var override, following D004 pattern
- **Rationale:** BackendConfig encapsulates all backend-specific paths/behavior (agent dir, settings path, session map, prompts dir, spawn args, skills dirs). Getter function (not const) allows tests to override PI_ACP_PI_COMMAND at runtime. Factory functions provide immutable config objects for each backend. Extends D004 pattern to a comprehensive backend abstraction.
- **Revisable:** Yes

### D002: CI workflow structure

- **When:** —
- **Choice:** Split CI into three independent jobs (typecheck, lint, test) for faster feedback and isolation
- **Rationale:** Three independent jobs provide parallel execution on GitHub Actions, giving faster feedback on different failure modes. Isolation means a typecheck failure doesn't block lint/test from running, providing more complete signal on PR quality. Each job follows the npm-publish.yml pattern for consistency.
- **Revisable:** Yes

## Superseded Decisions

(none)
