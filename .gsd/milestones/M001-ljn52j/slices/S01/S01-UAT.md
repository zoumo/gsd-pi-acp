# S01: Robustness Foundation — UAT

**Milestone:** M001-ljn52j
**Written:** 2026-04-02T17:40:25.253Z

# S01 UAT: Robustness Foundation

**Scenario**: Kill gsd mid-prompt → adapter returns timeout error to Zed within 30s, debug log written at expected path, no orphan gsd process running after adapter exit

## Preconditions

1. Adapter built and installed: `npm run build && npm link`
2. Zed configured with gsd-pi-acp as external agent
3. `gsd` command available in PATH

## Test Cases

### TC01: RPC Request Timeout

**Purpose**: Verify adapter returns timeout error within 30s when backend hangs

**Steps**:
1. Set env: `PI_ACP_DEBUG_LOG=1 PI_ACP_RPC_TIMEOUT_MS=5000` (5s timeout for faster test)
2. Spawn adapter from Zed with gsd backend
3. Send prompt that causes gsd to hang (e.g., kill gsd subprocess mid-response)
4. Wait for adapter response

**Expected**: 
- Adapter returns error to Zed within 5s (not hanging indefinitely)
- Debug log contains: `timeout command=prompt id=<id> duration=5000ms`
- Error message indicates timeout

**Verify**: `cat ~/.gsd/gsd-pi-acp/debug.log | grep -q "timeout"`

---

### TC02: Clean Process Shutdown on Disconnect

**Purpose**: Verify no orphan gsd processes after adapter exit

**Steps**:
1. Start adapter: `PI_ACP_PI_COMMAND=gsd PI_ACP_DEBUG_LOG=1 gsd-pi-acp`
2. Send prompt from client, receive response
3. Kill adapter process (SIGTERM or disconnect)
4. Check for orphan processes

**Expected**:
- Debug log contains: `shutdown` and `exit code=...`
- No `gsd --mode rpc` process running after adapter exit

**Verify**: 
```bash
ps aux | grep "gsd --mode rpc" | grep -v grep
# Should return empty (no orphan process)
```

---

### TC03: Debug Logging Opt-in

**Purpose**: Verify logging only occurs when env var set

**Steps**:
1. Run adapter WITHOUT `PI_ACP_DEBUG_LOG`: `gsd-pi-acp`
2. Send prompt, receive response, exit
3. Check for log file
4. Run adapter WITH `PI_ACP_DEBUG_LOG=1`
5. Send prompt, exit
6. Check for log file

**Expected**:
- Step 3: No log file created (or no new entries)
- Step 6: Log file exists with spawn/exit/shutdown events

**Verify**:
```bash
# Without logging - file should not exist or be empty
test -f ~/.gsd/gsd-pi-acp/debug.log && echo "FAIL: log exists without env var" || echo "PASS"

# With logging - file should exist with entries
PI_ACP_DEBUG_LOG=1 gsd-pi-acp --version
cat ~/.gsd/gsd-pi-acp/debug.log | grep -q "spawn" && echo "PASS" || echo "FAIL"
```

---

### TC04: Queue Overflow Rejection

**Purpose**: Verify adapter rejects prompts when queue full

**Steps**:
1. Set env: `PI_ACP_MAX_QUEUE_DEPTH=3`
2. Start adapter
3. Send 4 prompts rapidly (first starts turn, 3 queue, 4th should reject)
4. Check response for 4th prompt

**Expected**:
- 4th prompt rejected with error: `Turn queue full (max 3 pending prompts)`
- Debug log contains: `queue overflow depth=3`

**Verify**: Error message visible in Zed UI with "queue full" text

---

### TC05: Custom Debug Log Path

**Purpose**: Verify path override works with validation

**Steps**:
1. Set env: `PI_ACP_DEBUG_LOG=1 PI_ACP_DEBUG_LOG_PATH=/tmp/gsd-pi-acp-uat.log`
2. Run adapter, send prompt, exit
3. Check log at custom path

**Expected**:
- Log file at `/tmp/gsd-pi-acp-uat.log` with entries
- Default path `~/.gsd/gsd-pi-acp/debug.log` NOT created

**Verify**:
```bash
test -f /tmp/gsd-pi-acp-uat.log && grep -q "spawn" /tmp/gsd-pi-acp-uat.log && echo "PASS" || echo "FAIL"
```

---

### TC06: Path Traversal Rejection

**Purpose**: Verify malicious paths rejected

**Steps**:
1. Set env: `PI_ACP_DEBUG_LOG=1 PI_ACP_DEBUG_LOG_PATH=/tmp/../etc/passwd`
2. Run adapter

**Expected**:
- Adapter starts successfully (doesn't crash)
- Log NOT written to `/etc/passwd`
- Path validation rejects traversal pattern

**Verify**:
```bash
# Should not create or modify /etc/passwd
# Adapter should function normally
```

---

## Edge Cases

### EC01: Multiple Concurrent Timeouts

- Send multiple prompts, kill gsd before any complete
- All pending requests should timeout within configured duration
- Debug log shows multiple timeout events

### EC02: Zero Queue Depth

- Set `PI_ACP_MAX_QUEUE_DEPTH=0`
- Only one prompt at a time (no queueing)
- Second prompt immediately rejected

---

## Cleanup

After UAT:
```bash
rm -f ~/.gsd/gsd-pi-acp/debug.log
rm -f /tmp/gsd-pi-acp-uat.log
```
