# S04: Operational/performance improvements (P2: #7, #13, #17) and remaining cleanup (P1: #6, P2: #18-19, P3: #26, #28, #30, #31)

**Goal:** Cache backend detection, reduce sync startup probes, add shutdown reentrance guard, fix remaining type safety and robustness issues
**Demo:** After this: After this slice: backend detection is cached (no repeated spawnSync); shutdown is idempotent; assert/strict used in process tests; compareSemver handles pre-release; event handlers iterated safely; unnecessary as-any casts removed

## Tasks
