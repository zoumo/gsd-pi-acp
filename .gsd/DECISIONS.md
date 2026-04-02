# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | 2025-04-03 | planning | Slice ordering for M001-ljn52j | S01 → S02 → S03 → S04 — robustness fixes first (foundation for safe execution), then dual backend (primary user value), then tests (safety net), then refactor (architecture improvement) | S01 robustness (timeout, shutdown, logging) is prerequisite for safe execution of all subsequent work — without it, S02 could hang indefinitely and be undebuggable. S02 delivers primary user value (gsd backend). S03 test coverage provides safety net before S04 high-churn refactor. Ordering reflects dependency chain and risk mitigation. | Yes | agent |