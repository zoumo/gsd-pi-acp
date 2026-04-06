# M002-bkli1x: 

## Vision
Address P1-P3 findings from code review of S01 robustness work: NaN guard on RPC timeout, stderr fallback for unhandledRejection, replace custom isAbsolutePath with node:path, and cache mkdir in logger. Small targeted fixes, zero risk of regression.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Code Review Remediation | low | — | ⬜ | PI_ACP_RPC_TIMEOUT_MS=abc → timeout defaults to 30000 (not NaN/1ms). unhandledRejection writes to stderr without PI_ACP_DEBUG_LOG. path.isAbsolute() used instead of custom function. Logger mkdir called once not per-write. |
