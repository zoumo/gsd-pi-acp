# M003: Code Hygiene: Dead Code, Type Safety, Async I/O

## Vision
Address findings from deep code audit: remove 30+ dead exports and legacy functions, delete .bak file, add types for pi RPC events to eliminate as-any in hot paths, convert sync fs to async in session-loading and event-handling paths.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Dead Code Removal | low | — | ✅ | rg for removed symbols returns zero hits; no .bak files; test suite passes unchanged. |
| S02 | Pi RPC Event Types & as-any Reduction | medium | — | ✅ | session.ts as-any count ≤5; pi-tools.ts as-any count 0; handlePiEvent uses typed event access. |
| S03 | Async I/O in Session Loading & Event Handling | medium | — | ✅ | Zero sync fs calls in pi-sessions.ts. readFileSync in session.ts event handler replaced with async read. |
