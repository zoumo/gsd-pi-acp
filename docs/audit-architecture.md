# 架构与代码质量审计

> 审计对象：`src/` 所有源文件（约 3,400 行）
> 审计维度：模块划分、职责分离、类型安全、代码质量

---

## 一、整体架构图

```
index.ts                      ← 入口：stdio 管道、关闭信号处理
  └─ acp/agent.ts             ← ACP 协议处理器（God Object，1356 行）
       ├─ acp/session.ts      ← Session 生命周期 + 事件翻译 + 队列（689 行）
       │    └─ pi-rpc/process.ts  ← 子进程管理 + NDJSON RPC（339 行）
       │         └─ pi-rpc/command.ts  ← 可执行文件解析（16 行）
       ├─ acp/session-store.ts     ← JSON 文件持久化
       ├─ acp/pi-sessions.ts       ← 文件系统 session 扫描
       ├─ acp/pi-settings.ts       ← 配置合并（global + project）
       ├─ acp/pi-commands.ts       ← pi get_commands → ACP 转换
       ├─ acp/slash-commands.ts    ← 文件模板加载与展开
       ├─ acp/auth.ts / auth-required.ts  ← 认证流程
       └─ acp/translate/          ← 消息/工具/Prompt 翻译层
```

无循环依赖，依赖图是干净的 DAG。底层分层是合理的。

---

## 二、架构问题

### ❌ A1：`agent.ts` 是 1356 行的 God Object

`PiAcpAgent` 类承担了过多职责：

- ACP 协议方法（initialize / newSession / prompt / loadSession / listSessions）
- **10 个内联 slash 命令**（`/compact`、`/autocompact`、`/session`、`/name`、`/steering`、`/follow-up`、`/changelog`、`/export` 等），每个是 20–60 行的 `if` 块
- 模型切换与 thinking 等级管理
- 启动信息构建（`buildStartupInfo`，扫描 skills / extensions / prompts / themes）
- npm 版本检查（`buildUpdateNotice`）
- package.json 读取

其中 `prompt()` 方法单独就有约 430 行。

**影响**：每个新命令都使 monolith 膨胀；单元测试困难；逻辑耦合不可分离。

**建议**：
```
acp/agent.ts          ← 只保留 ACP 协议方法（~200 行）
acp/commands/         ← 每个 slash 命令一个文件
acp/startup-info.ts   ← buildStartupInfo / buildUpdateNotice
acp/agent-info.ts     ← readNearestPackageJson + agentInfo 构建
```

---

### ❌ A2：`SessionStore` 双实例问题

```typescript
// agent.ts:104
private readonly store = new SessionStore()

// session.ts:67（SessionManager 内部）
private readonly store = new SessionStore()
```

两个完全独立的 `SessionStore` 实例读写**同一个文件** `~/.pi/pi-acp/session-map.json`。`SessionStore` 没有内存缓存，每次 `get()` 都从磁盘读取，所以暂时不会数据冲突——但职责划分不清：

- `agent.ts` 中的 store 只在 `loadSession()` 中使用（第 849 行）
- `session.ts` 中的 store 只在 `create()` 中使用（第 121 行）

**建议**：`SessionStore` 单例注入，或将其完全移入 `SessionManager`，`agent.ts` 不再直接持有。

---

### ❌ A3：`buildStartupInfo` / `buildUpdateNotice` 不属于 `agent.ts`

这两个函数（agent.ts 第 1128–1311 行，约 180 行）做的是：
- 扫描 `~/.pi/agent/skills/`、`extensions/`、`prompts/`、`themes/` 目录
- 调用 `spawnSync('npm', ['view', ..., 'version'])` 检查 npm 版本
- 调用 `spawnSync('pi', ['--version'])` 检查版本号

这些都是纯粹的**展示层逻辑**，与 ACP 协议完全无关。应独立到 `acp/startup-info.ts`。

---

### ❌ A4：`readNearestPackageJson` 是埋在底部的通用工具函数

`agent.ts` 第 1333–1356 行是一个通用文件系统工具函数，应移至 `utils/pkg.ts` 或类似位置。

---

## 三、类型安全问题

### ❌ T1：`as any` 泛滥——72 处强制类型转换

项目 AGENTS.md 明确要求"避免使用 `any`"，但 `as any` 出现了 **72 次**。

最严重的模式——pi RPC 响应完全无类型：

```typescript
// agent.ts:189
state = s as any

// agent.ts:197
availableModels = m as any

// agent.ts:346
const stats = (await session.proc.getSessionStats()) as any

// agent.ts:986
const data = (await session.proc.getAvailableModels()) as any
```

`getState()`、`getAvailableModels()`、`getSessionStats()`、`getMessages()`、`getCommands()` 全部返回 `Promise<unknown>`，然后立即被 `as any` 强转。整个 pi→ACP 翻译层在 `any` 上运作，**TypeScript 类型检查形同虚设**。

**建议**：为 pi RPC 响应定义 Zod schema，在 `process.ts` 的 `request()` 出口处做一次性 parse，后续代码拿到的是有类型的数据。

---

### ❌ T2：`session.ts` 的事件处理完全无类型

```typescript
// session.ts（事件处理入口）
proc.onEvent(ev => {
  const type = (ev as any).type  // ← as any
  // ...
  const toolName = (ev as any).toolName
  const args = (ev as any).args
})
```

pi 发出的所有事件（`tool_execution_start`、`tool_execution_end`、`message_delta` 等）都经由 `PiRpcEvent = Record<string, unknown>` 类型传递，访问每个字段都要 `as any`。

**建议**：定义 pi 事件 discriminated union（可以从实际协议中提取），用类型收窄代替 `as any`。

---

### ❌ T3：`index.ts` 中的关闭逻辑依赖 SDK 内部私有属性

```typescript
// index.ts:61
;(agent as any)?.agent?.dispose?.()
```

`AgentSideConnection` 的 `.agent` 属性是 SDK 内部实现细节，不是公开 API。SDK 一旦重构，这里**静默失效**，子进程泄漏，没有任何错误提示（外层 `catch {}` 吞掉所有异常）。

**建议**：直接持有 `PiAcpAgent` 引用：
```typescript
const piAgent = new PiAcpAgent(conn)
const agent = new AgentSideConnection(() => piAgent, stream)

function shutdown() {
  piAgent.dispose()
  process.exit(0)
}
```

---

## 四、代码质量问题

### ❌ Q1：`prompt()` 中使用魔法字符串作为命令路由

```typescript
// agent.ts（prompt 方法内部，约 430 行）
if (commandName === 'compact') { ... }
else if (commandName === 'autocompact') { ... }
else if (commandName === 'session') { ... }
else if (commandName === 'name') { ... }
// ... 共 10 个 else if
```

命令名作为字符串字面量分散在整个方法中，既难以维护，也无法通过 TypeScript 检查来防止拼写错误。

**建议**：命令 dispatch 表：
```typescript
const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  compact: handleCompact,
  autocompact: handleAutocompact,
  // ...
}
```

---

### ❌ Q2：`HOME` 环境变量硬编码降级为空字符串

```typescript
// agent.ts:1276, 1287, 1298, 1308
const projectSkillsDir = join(process.env.HOME ?? '', '.pi', 'agent', 'skills')
const promptsDir = join(process.env.HOME ?? '', '.pi', 'agent', 'prompts')
const extDir    = join(process.env.HOME ?? '', '.pi', 'agent', 'extensions')
```

`HOME` 未设置时，路径变成 `/.pi/agent/skills`（根目录相对），在 CI 环境或 Docker 中会静默扫描错误路径。

应一律使用 `os.homedir()`，和其他地方保持一致。

---

### ❌ Q3：`pi-sessions.ts` 的同步 FS 扫描阻塞事件循环

`listPiSessions()` 同步遍历 `~/.pi/agent/sessions/` 目录下的所有 `.jsonl` 文件，对每个文件都做头尾读取。`findPiSessionFile()` 调用 `listPiSessions()` 后再过滤——用户有数百个 session 时，每次 `listSessions` / `loadSession` 请求都会**明显阻塞**。

---

### ❌ Q4：`spawnSync` 在请求处理路径中阻塞

```typescript
// agent.ts:1213（buildUpdateNotice）
const piVersion = spawnSync('pi', ['--version'], { encoding: 'utf-8' })
// 无 timeout！

// agent.ts（buildUpdateNotice）
const latestRes = spawnSync('npm', ['view', '...', 'version'], {
  encoding: 'utf-8',
  timeout: 800   // 有 timeout，但仍然同步阻塞
})
```

`pi --version` 没有 timeout，如果 `pi` 启动缓慢（如网络挂载的 nvm），会冻结整个适配器进程。

---

### ❌ Q5：`session-store.ts` 每次操作都全量读写文件且从不剪枝

```typescript
upsert(entry): void {
  const db = loadFile(this.path)        // 每次全量读取 + 反序列化
  db.sessions[entry.sessionId] = { ... }
  saveFile(this.path, db)               // 每次全量序列化 + 写入
}
```

session 条目永远不删除。长期使用后文件可包含数千条记录，每次 upsert 都序列化整个文件。

---

## 五、总结优先级

| 优先级 | 问题 | 文件 |
|--------|------|------|
| 🔴 高 | `as any` 泛滥，类型安全崩溃 | 全局 |
| 🔴 高 | `index.ts` 关闭依赖 SDK 私有属性 | `index.ts:61` |
| 🔴 高 | `agent.ts` God Object，无法单测 | `agent.ts` |
| 🟡 中 | `SessionStore` 双实例 | `agent.ts:104`, `session.ts:67` |
| 🟡 中 | `buildStartupInfo` 等混入协议层 | `agent.ts:1128` |
| 🟡 中 | 同步 FS 扫描阻塞事件循环 | `pi-sessions.ts` |
| 🟡 中 | `spawnSync` 无 timeout | `agent.ts:1213` |
| 🟢 低 | `HOME` 降级为空字符串 | `agent.ts:1276` |
| 🟢 低 | SessionStore 不剪枝 | `session-store.ts` |
