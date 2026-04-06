# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 |  | architecture | BackendConfig abstraction pattern | BackendConfig interface + factory functions (gsdConfig/piConfig) + getter function (getBackendConfig) for runtime env var override, following D004 pattern | BackendConfig encapsulates all backend-specific paths/behavior (agent dir, settings path, session map, prompts dir, spawn args, skills dirs). Getter function (not const) allows tests to override PI_ACP_PI_COMMAND at runtime. Factory functions provide immutable config objects for each backend. Extends D004 pattern to a comprehensive backend abstraction. | Yes | agent |
| D002 |  | ci | CI workflow structure | Split CI into three independent jobs (typecheck, lint, test) for faster feedback and isolation | Three independent jobs provide parallel execution on GitHub Actions, giving faster feedback on different failure modes. Isolation means a typecheck failure doesn't block lint/test from running, providing more complete signal on PR quality. Each job follows the npm-publish.yml pattern for consistency. | Yes | agent |
