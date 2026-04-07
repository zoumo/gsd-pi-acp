# M004: Code Review Remediation — Hang/Leak, Correctness, Tests, Performance

## Vision
Fix the issues identified in the 2026-04-08 deep code review, in priority order: hang/leak paths (#1-3,5), low-effort correctness (#11,14,15,29), false-confidence tests (#8,9,22), operational/performance (#7,12,13,17), and remaining cleanup (#6,18,19,26,28,30,31).

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Fix hang/leak paths (P1: #1, #2, #3, #5) | medium | — | ✅ | After this slice: subprocess crash resolves pending prompt instead of hanging; session close resolves in-flight prompt; post-spawn failures clean up the subprocess; exit handler exceptions don't prevent pending promise rejection |
| S02 | Fix low-effort correctness bugs (P2: #11, #14, #15, #29) | low | — | ✅ | After this slice: negative PI_ACP_MAX_QUEUE_DEPTH falls back to default; fallback sessionUpdate errors don't escape setTimeout; /pitools/gsd-disabled/pi is not detected as gsd; subprocess stderr is captured in debug log |
| S03 | Repair false-confidence tests (P2: #8, #9, #22) | low | — | ✅ | After this slice: merge-commands test imports from real source; stdout-destroyed test imports writer logic or tests actual module; queue overflow test uses finally for env cleanup |
| S04 | Operational/performance improvements (P2: #7, #13, #17) and remaining cleanup (P1: #6, P2: #18-19, P3: #26, #28, #30, #31) | low | S03 | ⬜ | After this slice: backend detection is cached (no repeated spawnSync); shutdown is idempotent; assert/strict used in process tests; compareSemver handles pre-release; event handlers iterated safely; unnecessary as-any casts removed |
