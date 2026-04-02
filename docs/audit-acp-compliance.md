# ACP 协议合规性审计

> 审计对象：`src/acp/` 全部文件 + `@agentclientprotocol/sdk` v0.12.0 类型定义
> 审计维度：协议完整性、类型正确性、session 生命周期、auth 流程

---

## 一、ACP SDK 提供的接口

### Agent 端必须实现的方法

| 方法 | 描述 | 实现状态 |
|------|------|---------|
| `initialize` | 握手，返回 agentInfo + capabilities | ✅ 已实现 |
| `newSession` | 创建新 session | ✅ 已实现 |
| `prompt` | 发送用户消息 | ✅ 已实现 |
| `cancel` | 取消当前 turn | ✅ 已实现 |
| `listSessions` | 列出历史 session | ✅ 已实现（`unstable_listSessions`） |
| `loadSession` | 加载历史 session | ✅ 已实现 |
| `authenticate` | 处理 auth 回调 | ✅ 已实现 |
| `setSessionMode` | 设置 session 模式 | ✅ 已实现 |

### Agent 端可以主动调用的 Client 方法

| 方法 | 描述 | 使用状态 |
|------|------|---------|
| `sessionUpdate` | 推送 session 事件 | ✅ 大量使用 |
| `requestPermission` | 请求用户授权 | ❌ **未使用** |
| `readTextFile` | 读取客户端文件 | ❌ 未使用（有意跳过） |
| `writeTextFile` | 写入客户端文件 | ❌ 未使用（有意跳过） |
| `createTerminal` | 在客户端创建终端 | ❌ 未使用（有意跳过） |
| `extMethod` | 扩展方法 | ❌ 未使用 |
| `extNotification` | 扩展通知 | ❌ 未使用 |

---

## 二、已实现功能的问题

### ❌ P1：`authenticate` 方法接受任何认证尝试

```typescript
// agent.ts
async authenticate(_params: AuthenticateRequest) {
  return {}  // 无条件成功
}
```

ACP auth 流程要求 Agent 验证客户端提交的认证信息（例如验证 API key 有效性），然后返回成功或失败。当前实现**总是返回成功**，没有实际验证，仅靠 `hasAnyPiAuthConfigured()` 的 pre-spawn 检查。

**影响**：客户端显示 "认证成功"，但实际的 API key 可能仍然无效。

---

### ❌ P2：未实现 `requestPermission`——pi 工具调用缺乏授权机制

```typescript
// ACP SDK 提供：
conn.requestPermission(params): Promise<RequestPermissionResponse>
```

pi 在执行破坏性操作（删除文件、运行命令等）前可以向用户请求确认。当前适配器未实现 `requestPermission`，所有 pi 工具调用都无需用户确认就执行。

**影响**：ACP 客户端（如 Zed）中的"Permission Request"UI 永远不会触发。

---

### ❌ P3：`setSessionMode` 仅支持 `agent` 模式

```typescript
// agent.ts
async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
  if (params.mode !== 'agent') {
    throw RequestError.invalidParams(`Unsupported mode: ${params.mode}`)
  }
  return { mode: 'agent' }
}
```

ACP 规范支持 `agent`、`edit`、`plan` 等模式。当前仅接受 `agent` 模式，其余均报错。若 Zed 等客户端发送其他模式，会报错。

---

### ❌ P4：`unstable_listSessions` 使用了非标准 API

```typescript
// agent.ts — method name 带 unstable_ 前缀
async unstable_listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse>
```

ACP SDK 当前版本（0.12.0）中 `listSessions` 是稳定 API。使用 `unstable_` 前缀是为了对应 Zed 的特定实现，但这不是标准 ACP 行为。若 Zed 升级 ACP 版本，此方法名可能失效。

---

### ❌ P5：session update 中 `_meta` 字段滥用非标准扩展数据

```typescript
// session.ts:252
this.emit({
  sessionUpdate: 'agent_message_chunk',
  content: { type: 'text', text: '...' },
  _meta: { piAcp: { queueDepth: this.turnQueue.length, running: true } }
})
```

`_meta` 字段是 ACP 的扩展机制，当前被用于传输 `piAcp` 内部状态（队列深度、运行状态）。这些信息没有文档记录，客户端不知道如何使用，但也不会导致错误。

---

## 三、类型正确性问题

### ❌ T1：ACP response type 强转

```typescript
// agent.ts:137
return {
  protocolVersion: ...,
  agentInfo: { ... },
  authMethods: getAuthMethods(...) as any,  // ← as any
  agentCapabilities: { ... } as any          // ← as any
}
```

`agentCapabilities` 和 `authMethods` 使用 `as any` 绕过类型检查。SDK 的 `InitializeResponse` 有完整类型定义，应直接使用。

---

### ❌ T2：`sessionCapabilities.list` 使用了非标准结构

```typescript
// agent.ts:147
sessionCapabilities: {
  list: {}   // ← ACP SDK 中这个字段的类型是什么？
}
```

ACP SDK 0.12.0 中 `sessionCapabilities` 的 `list` 字段类型未在标准文档中明确定义，使用 `{}` 是 Zed 特定的 hack。

---

### ❌ T3：PromptResponse 类型不匹配

```typescript
// agent.ts 中 prompt() 的某些分支返回 void，某些返回对象
// 但 PromptResponse 有明确的 stopReason 字段要求
```

部分 slash 命令处理路径隐式 `return undefined`，依赖 TypeScript 接受 `void` 作为 `Promise<PromptResponse>` 的实现。这在某些严格模式下会报错。

---

## 四、Session 生命周期正确性

### ✅ 已正确实现

- Session 创建时 spawn pi 子进程
- Session 的 turn 串行化（`pendingTurn` + `turnQueue`）
- cancel 信号正确转发给 pi（`proc.abort()`）
- `loadSession` 时旧进程被清理，新进程 spawn

### ❌ L1：loadSession 后 sessionId 的连续性

```typescript
// agent.ts: loadSession
const session = await this.sessions.create({ cwd: params.cwd, ... })
// 新 session 的 sessionId 来自新 spawn 的 pi 进程
// 但客户端期望 loadSession 返回原来的 sessionId
```

`loadSession` 是否能保证返回与传入 `sessionId` 相同的 sessionId？当前实现 spawn 新 pi 进程，pi 自己会读取 JSONL 文件并恢复 session ID。若 pi 读取成功，则 ID 一致；若失败，则返回新 ID，客户端会混淆。

---

### ❌ L2：`cancel` 通知无 ACK 等待

```typescript
// session.ts
async cancel() {
  await this.proc.abort()
  // abort() 向 pi 发送 { type: 'abort' }，pi 返回 { success: true }
  // 但 ACP 的 cancel 是 Notification（不期望响应）
  // pi 的实际取消是异步的，cancel 返回后 pi 可能还在运行
}
```

`proc.abort()` 向 pi 发送 RPC 请求并等待响应，但 pi 的取消是异步的——pi 收到 abort 后会在完成当前 tool 执行后才停止。ACP cancel 不应阻塞，当前实现会等待 pi 的 RPC 确认响应（但不等待实际停止）。

---

## 五、Auth 流程合规性

### ACP auth 流程要求

1. Agent 在 `initialize` 中声明支持的 `authMethods`
2. 若需要认证，在 `newSession` 中抛出 `RequestError.authRequired`
3. 客户端触发认证，调用 `authenticate`
4. Agent 验证后返回成功/失败

### 当前实现

```typescript
// ✅ initialize 中声明 authMethods（含 terminal-auth 扩展）
// ✅ newSession 在无 auth 时抛出 RequestError.authRequired
// ❌ authenticate 无条件返回成功（见 P1）
// ❌ 无 re-check 机制：authenticate 后不重新验证 hasAnyPiAuthConfigured()
```

Terminal auth 流程（`--terminal-login` flag）是 Zed 的私有扩展，适配器正确实现了这个扩展，但：
1. auth method 的 `type: 'terminal'` + `args: ['--terminal-login']` 是 ACP 注册表要求的格式
2. `_meta['terminal-auth']` 的 launch spec 是 Zed 特有扩展，注释中已说明

整体 auth 流程对 Zed 来说是 functional 的，但不符合 ACP 规范中"agent 应验证认证"的要求。

---

## 六、ACP 事件翻译完整性

### pi 事件 → ACP sessionUpdate 映射

| pi 事件类型 | ACP sessionUpdate 类型 | 映射状态 |
|------------|----------------------|---------|
| `message_delta` | `agent_message_chunk` | ✅ |
| `tool_execution_start` | `tool_call` | ✅ |
| `tool_execution_end` | `tool_call_update` | ✅ |
| `thinking_delta` | `agent_message_chunk`（thinking） | ✅ |
| `done` | `stop_turn`（`end_turn`） | ✅ |
| `error` | `stop_turn`（`error`） | ✅ |
| `abort` | `stop_turn`（`cancelled`） | ✅ |
| `tool_approval_request` | `tool_call` + `requestPermission` | ❌ 仅发 tool_call，未调用 requestPermission |
| `context_limit` | `agent_message_chunk`（提示信息） | ✅（heuristic） |
| `prelude` | `agent_message_chunk`（startup info） | ✅ |

### ❌ E1：`tool_approval_request` 事件未触发 requestPermission

pi 的 `tool_approval_request` 事件表示 pi 在等待用户批准某个危险操作。当前适配器仅将其翻译为文本消息发送，未调用 ACP 的 `requestPermission` API，导致 Zed 等客户端的权限 UI 永远不会弹出。

---

## 七、总结

| 优先级 | 问题 | 影响 |
|--------|------|------|
| 🔴 高 | `authenticate` 无条件成功 | 认证状态与实际不符 |
| 🔴 高 | `tool_approval_request` 未调用 `requestPermission` | 安全操作缺乏用户确认 |
| 🟡 中 | `unstable_listSessions` 非标准 API | SDK 升级后失效风险 |
| 🟡 中 | `setSessionMode` 只支持 `agent` | 客户端请求其他模式时报错 |
| 🟡 中 | ACP response 类型使用 `as any` | 类型安全缺失 |
| 🟢 低 | `_meta.piAcp` 非标准扩展 | 无文档，客户端忽略 |
| 🟢 低 | `sessionCapabilities.list: {}` Zed hack | SDK 升级后可能失效 |
