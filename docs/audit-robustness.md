# 健壮性与安全审计

> 审计对象：`src/` 所有源文件
> 审计维度：安全性、进程健壮性、资源管理、优雅关闭、可观测性

---

## 一、安全问题

### 🟡 S1（中）：完整 `process.env` 透传给子进程

```typescript
// src/pi-rpc/process.ts:138
const child = spawn(cmd, args, {
  cwd: params.cwd,
  stdio: 'pipe',
  env: process.env,   // ← 整个父进程环境变量全部传给 pi
  shell: shouldUseShellForPiCommand(cmd)
})
```

适配器进程的所有环境变量（数据库密码、其他服务 token 等）都暴露给了 pi 子进程。若 pi 存在漏洞，攻击面会扩展到父进程中的全部机密。

**建议**：显式过滤环境变量，只传 pi 运行所必需的：
```typescript
const env = filterEnv(process.env, [
  'PATH', 'HOME', 'USER', 'TMPDIR',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', /* ... */
  'PI_CODING_AGENT_DIR'
])
```

---

### 🟡 S2（低）：Windows 下 `shell: true` + 用户可控命令名

```typescript
// src/pi-rpc/command.ts:10-14
export function shouldUseShellForPiCommand(cmd: string): boolean {
  if (platform() !== 'win32') return false
  const normalized = cmd.trim().toLowerCase()
  return normalized.endsWith('.cmd') || normalized.endsWith('.bat')
}
```

`PI_ACP_PI_COMMAND` 环境变量由用户控制。Windows 上若其值为 `evil.cmd & calc.exe`，`shell: true` 时会被 shell 解析执行。虽然前提是用户自己设置了该变量（属于自我攻击），仍应防御：

**建议**：验证命令中不含 shell 特殊字符，或改用 `args` 数组形式传参。

---

### 🟢 S3（无）：无日志泄露机密

生产代码中无任何 `console.log` / `logger.*` 调用。auth token 只做 `.trim()` 非空检查，从不打印值。

---

## 二、进程健壮性

### 🔴 R1（高）：RPC 请求无超时——Promise 可能永久挂起

```typescript
// src/pi-rpc/process.ts:293-313
private request(cmd: PiRpcCommand): Promise<PiRpcResponse> {
  const id = crypto.randomUUID()
  return new Promise<PiRpcResponse>((resolve, reject) => {
    this.pending.set(id, { resolve, reject })
    this.child.stdin.write(JSON.stringify({ ...cmd, id }) + '\n', err => {
      if (err) { this.pending.delete(id); reject(err) }
    })
  })
  // 没有 AbortController，没有 setTimeout，没有超时
}
```

若 pi 子进程死锁（stdout 停止输出但进程未退出），pending Map 中的 Promise 将**永远等待**。`pending` 只在进程 `exit` 或 `error` 事件时才被清理。一个卡住的 RPC 调用会冻结整个 session。

**建议**：
```typescript
private request(cmd: PiRpcCommand, timeoutMs = 30_000): Promise<PiRpcResponse> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const timer = setTimeout(() => {
      this.pending.delete(id)
      reject(new Error(`RPC timeout: ${cmd.type} (${timeoutMs}ms)`))
    }, timeoutMs)
    this.pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v) },
      reject:  (e) => { clearTimeout(timer); reject(e) }
    })
    // ...write...
  })
}
```

---

### 🟡 R2（中）：`readline` 接口未在 `dispose()` 中显式关闭

```typescript
// src/pi-rpc/process.ts:98-99
const rl = readline.createInterface({ input: child.stdout })
rl.on('line', line => { ... })

// dispose() 方法只调用了 child.kill()，未调用 rl.close()
dispose(signal = 'SIGTERM'): void {
  if (this.child.killed) return
  this.child.kill(signal as any)
  // ← rl 未关闭
}
```

杀死子进程会关闭其 stdout，readline 会触发 `close` 事件，实践中一般不泄漏——但显式调用 `rl.close()` 是防御性编程的正确做法。

---

### 🟡 R3（中）：Turn 队列无深度限制

```typescript
// src/acp/session.ts:216-231
if (this.pendingTurn) {
  this.turnQueue.push(queued)   // 无限追加
  this.emit({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: `Queued message (position ${this.turnQueue.length}).` }
  })
  return
}
```

行为异常的客户端可以发送数千条 prompt，每条含大量图片数据，全部驻留内存。没有背压机制。

**建议**：限制队列深度（如 10-20），超出时返回明确的错误：
```typescript
if (this.turnQueue.length >= MAX_QUEUE_DEPTH) {
  throw RequestError.invalidParams('Turn queue full. Wait for current turn to complete.')
}
```

---

### 🟡 R4（中）：并发 session 切换存在竞态窗口

```typescript
// agent.ts:257（prompt 方法内）
;(this.sessions as any).closeAllExcept?.(session.sessionId)
```

新 session 在第 178 行就已 spawn 完毕；`closeAllExcept` 在之后才调用。期间存在两个 pi 子进程并存的短暂时间窗口。若旧 session 有 in-flight 的 prompt，它的 Promise 会以 `error` 状态 resolve，但 ACP 客户端不会收到显式通知。

---

### 🟡 R5（中）：NDJSON 行无大小限制

Node.js `readline` 会把整行缓冲到内存中。若 pi 输出一个包含数千条消息的 `getMessages` 响应，全部内容都会在内存中缓冲为单个字符串。长会话或大文件操作的 tool result 可能触发 OOM。

---

### 🟢 R6（良好）：进程崩溃处理正确

```typescript
// src/pi-rpc/process.ts:113
child.on('exit', (code, signal) => {
  const err = new Error(`pi process exited (code=${code}, signal=${signal})`)
  for (const [, p] of this.pending) p.reject(err)
  this.pending.clear()
})
```

pi 崩溃时，所有 pending Promise 都被 reject，不会泄漏。

---

## 三、资源管理

### 🟡 M1（中）：`editSnapshots` Map 可无限增长

```typescript
// src/acp/session.ts
private editSnapshots = new Map<string, { path: string; oldText: string }>()
```

- `tool_execution_start`（`toolName === 'edit'`）时添加快照，存储**整个旧文件内容**
- `tool_execution_end` 时删除

若 `tool_execution_start` 触发后 pi 崩溃，对应的 `end` 事件永不到来，快照永久驻留内存（含完整文件内容）。

**建议**：在 `dispose()` 中清空；或为每个快照设置 TTL。

---

### 🟡 M2（低）：`SessionStore` 从不删除旧条目

```typescript
// src/acp/session-store.ts:39-50
upsert(entry): void {
  const db = loadFile(this.path)      // 每次全量读取
  db.sessions[entry.sessionId] = { ... }
  saveFile(this.path, db)             // 每次全量写入
}
```

session 条目永远不清理。数月使用后文件可含数千条记录。每次 `upsert` 都需要序列化/反序列化全部内容。

---

## 四、优雅关闭

### 🔴 G1（高）：关闭逻辑依赖 SDK 内部私有属性

```typescript
// src/index.ts:61-65
function shutdown() {
  try {
    ;(agent as any)?.agent?.dispose?.()  // ← SDK 私有属性
  } catch {
    // ignore（吞掉一切错误，包括"属性不存在"的情况）
  }
  process.exit(0)
}
```

`AgentSideConnection.agent` 是 SDK 未公开的内部属性。SDK 重构后此处**静默失效**，pi 子进程在父进程退出后成为孤儿进程。`catch {}` 块吞掉任何失败指示。

**修复**（详见架构审计 T3）：直接持有 `PiAcpAgent` 引用。

---

### 🟡 G2（中）：无 `unhandledRejection` / `uncaughtException` 处理器

无 `process.on('unhandledRejection')` 或 `process.on('uncaughtException')`。
`setTimeout` 回调中的 `void (async () => { ... })()` 模式（agent.ts 第 265、934 行）内部有 try/catch，但任何遗漏的边缘情况都会让进程在无清理的情况下崩溃。

**建议**：
```typescript
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`Unhandled rejection: ${reason}\n`)
  // 可选：piAgent.dispose() 后 process.exit(1)
})
```

---

### 🟢 G3（良好）：SIGINT / SIGTERM 和 stdin 事件均已处理

```typescript
process.stdin.on('end', shutdown)
process.stdin.on('close', shutdown)
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

覆盖了常见的关闭场景。

---

## 五、可观测性

### 🔴 O1（高）：3,400 行生产代码中零日志

```
$ grep -rn 'console\.\|process.stderr.write' src/ | wc -l
0
```

没有任何结构化日志、debug 输出或诊断信息。生产环境中出现问题时：
- 无法知道哪些 session 被创建或销毁
- 无法知道 pi 子进程何时 spawn/exit
- 无法知道 RPC 命令的耗时
- 错误全部被 catch 后转换为 ACP 错误或静默丢弃
- 无法诊断挂起（见 R1）

**建议**：至少在 `stderr` 输出进程生命周期事件：
```typescript
// process.ts
process.stderr.write(`[pi-acp] spawn: cmd=${cmd} cwd=${params.cwd} pid=${child.pid}\n`)

child.on('exit', (code, signal) => {
  process.stderr.write(`[pi-acp] exit: pid=${child.pid} code=${code} signal=${signal}\n`)
})
```

---

## 六、Node.js 规范问题

### 🟡 N1（中）：`setTimeout` 中的 fire-and-forget async 块

```typescript
// agent.ts:265-302, 934-969
setTimeout(() => {
  void (async () => {
    try {
      // ...异步工作...
    } catch {
      // 空 catch，错误静默丢弃
    }
  })()
}, 0)
```

这些异步块在 ACP 请求/响应生命周期之外运行。Session 可能在 setTimeout 触发前就已被 dispose，导致向已销毁 session 发送 ACP update。

---

### 🟡 N2（低）：`index.ts` 中的 `--terminal-login` 分支使用 `spawnSync` 无 timeout

```typescript
// src/index.ts:7-21
const res = spawnSync(cmd, [], {
  stdio: 'inherit',
  env: process.env,
  shell: shouldUseShellForPiCommand(cmd)
  // 无 timeout
})
```

此处是交互式 terminal login，`spawnSync` 是合适的（需要等待用户输入）。但与其他地方的 `spawnSync` 一起，说明项目对同步/异步 spawn 的使用没有统一策略。

---

## 七、总结优先级

| 优先级 | ID | 问题 | 文件 |
|--------|----|------|------|
| 🔴 高 | R1 | RPC 请求无超时，Promise 可永久挂起 | `process.ts:293` |
| 🔴 高 | G1 | 关闭依赖 SDK 私有属性，子进程泄漏 | `index.ts:61` |
| 🔴 高 | O1 | 零日志，生产不可调试 | 全局 |
| 🟡 中 | R3 | Turn 队列无深度限制，OOM 风险 | `session.ts:216` |
| 🟡 中 | R2 | readline 未显式关闭 | `process.ts:98` |
| 🟡 中 | R4 | 并发 session 切换竞态窗口 | `agent.ts:257` |
| 🟡 中 | R5 | NDJSON 行无大小限制 | `process.ts:98` |
| 🟡 中 | M1 | editSnapshots 可无限增长 | `session.ts` |
| 🟡 中 | G2 | 无 unhandledRejection 处理器 | `index.ts` |
| 🟡 中 | N1 | fire-and-forget setTimeout async | `agent.ts:265` |
| 🟡 中 | S1 | 完整 env 透传给子进程 | `process.ts:138` |
| 🟢 低 | M2 | SessionStore 从不剪枝 | `session-store.ts` |
| 🟢 低 | S2 | Windows shell injection 风险 | `command.ts:10` |
