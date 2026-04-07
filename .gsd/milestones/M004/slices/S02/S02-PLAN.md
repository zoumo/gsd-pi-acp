# S02: Fix low-effort correctness bugs (P2: #11, #14, #15, #29)

**Goal:** Clamp queue depth to positive integer, wrap fallback sessionUpdate in try/catch, fix backend substring inference, capture subprocess stderr
**Demo:** After this: After this slice: negative PI_ACP_MAX_QUEUE_DEPTH falls back to default; fallback sessionUpdate errors don't escape setTimeout; /pitools/gsd-disabled/pi is not detected as gsd; subprocess stderr is captured in debug log

## Tasks
