# M001-ljn52j: 

## Vision
Make gsd-pi-acp a reliable ACP adapter that works daily from Zed with gsd as the primary backend, does not hang on subprocess issues, does not leak processes on disconnect, and has sufficient logging and test coverage to debug production issues. Maintain pi backend backward compatibility throughout.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Robustness Foundation | high | — | ✅ | Kill gsd mid-prompt → adapter returns timeout error to Zed within 30s, debug log written at expected path, no orphan gsd process running after adapter exit |
| S02 | Dual Backend Support | high | S01 | ✅ | Set PI_ACP_PI_COMMAND=gsd, connect from Zed, send prompt, receive response — session persists in gsd directory structure. Clear env var, verify pi backend still works unchanged. |
| S03 | Test Coverage + CI Gate | medium | S01, S02 | ✅ | Push to branch → CI runs typecheck + lint + test → all gates pass, PR mergeable. npm test covers process.ts timeout, concurrent requests, dispose, crash recovery. |
| S04 | Architecture Refactor | medium | S01, S02, S03 | ✅ | All existing tests still pass after refactor. agent.ts reduced from 1356 to <300 lines. Each extracted module has focused test. RPC responses validated through Zod schemas. |
