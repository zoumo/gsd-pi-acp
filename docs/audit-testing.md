# 测试与构建基础设施审计

> 审计对象：`test/`（1,814 行）、`scripts/`、`.github/workflows/`、配置文件
> 审计维度：测试覆盖率、测试质量、构建管道、CI/CD

---

## 一、测试覆盖率分析

### 已覆盖路径

| 测试文件 | 覆盖内容 |
|---------|---------|
| `unit/pi-messages.test.ts` | 消息内容规范化 |
| `unit/pi-tools.test.ts` | tool result → text 翻译 |
| `unit/prompt-to-pi-message.test.ts` | ACP Prompt → pi 消息转换 |
| `unit/pi-command.test.ts` | 可执行文件解析（平台差异） |
| `unit/pi-commands.test.ts` | get_commands → ACP 转换 |
| `unit/slash-commands.test.ts` | slash 命令加载与解析 |
| `unit/builtin-commands.test.ts` | 内置命令列表 |
| `unit/merge-commands.test.ts` | 命令合并去重 |
| `unit/startup-info-env.test.ts` | 启动信息（env var 路径） |
| `unit/startup-info-load-session.test.ts` | 启动信息（加载 session） |
| `unit/new-session-pi-not-found.test.ts` | pi 未安装时的错误处理 |
| `unit/new-session-auth-required-when-no-models.test.ts` | 无认证时 newSession 返回 AUTH_REQUIRED |
| `unit/pi-auth-gate-before-spawn.test.ts` | 认证门控（spawn 前检测） |
| `unit/auth-methods-terminal-auth-meta.test.ts` | auth method 构建 |
| `unit/stdout-destroyed-does-not-crash.test.ts` | stdout 已销毁时不崩溃 |
| `component/session-events.test.ts` | Session 事件翻译（577 行，最核心） |
| `component/session-list-and-load.test.ts` | session 列表与加载 |
| `component/session-*.test.ts` (7个) | 各种 session 场景 |

### ❌ C1：核心模块无测试覆盖

以下源码路径**完全没有测试**：

| 未覆盖文件/功能 | 原因 / 影响 |
|----------------|------------|
| `src/pi-rpc/process.ts` — `request()` 超时行为 | 最高风险路径（见健壮性 R1），无超时测试 |
| `src/pi-rpc/process.ts` — `dispose()` 清理 | readline 关闭、pending Promise reject |
| `src/pi-rpc/process.ts` — 并发 RPC 请求 | 多个同时进行的请求，ID 路由正确性 |
| `src/acp/session.ts` — Turn 队列溢出 | 无深度限制，客户端滥用路径 |
| `src/acp/session.ts` — `editSnapshots` 孤立 | pi 崩溃后快照未清理 |
| `src/acp/session.ts` — 并发 prompt 排队 | 多条 prompt 排队并按序执行 |
| `src/acp/session-store.ts` | 读写逻辑、并发 upsert |
| `src/acp/agent.ts` — 10 个 slash 命令 | `/compact`、`/session`、`/name`、`/changelog` 等 |
| `src/acp/agent.ts` — `buildStartupInfo` | 目录扫描逻辑 |
| `src/acp/agent.ts` — `buildUpdateNotice` | npm 版本检查 |
| `src/acp/pi-settings.ts` | `getQuietStartup`、`getEnableSkillCommands` |
| `src/acp/auth-required.ts` | 启发式认证错误检测 |
| `src/index.ts` — shutdown 序列 | SIGINT/SIGTERM 触发清理 |
| `src/index.ts` — `--terminal-login` 分支 | terminal auth 入口 |

---

### ❌ C2：测试覆盖的都是 Happy Path

现有 component 测试用的 `fakes.ts` 中的 `FakePiProcess` 是一个精心制作的 stub，但它只模拟了**成功**场景：

```typescript
// test/helpers/fakes.ts
export function makeFakePiProcess(events: PiRpcEvent[]): FakePiProcess {
  // 总是立即 resolve，总是成功
  // 从不模拟：超时、崩溃、乱序响应、stderr 输出
}
```

**缺失的错误路径测试**：
- pi 在处理 prompt 途中崩溃
- pi 响应格式错误（非 JSON、截断）
- RPC 请求超时（目前也没有实现超时）
- `getState()` 失败后 session 创建如何降级
- `switchSession()` 失败后 loadSession 回滚

---

## 二、测试基础设施问题

### ❌ I1：使用 `node:test` 而非成熟测试框架

```json
// package.json
"test": "node --import tsx --test test/**/*.test.ts"
```

`node:test` 在 Node.js 20+ 是内置的，但与 Vitest 或 Jest 相比：
- 没有内置 `mock.timers`（无法测试 setTimeout 超时逻辑）
- 没有 `vi.useFakeTimers()`（难以测试 RPC 超时）
- 错误信息可读性较差
- 没有内置 coverage 报告

**影响**：RPC 超时测试（最关键的缺失测试）在 `node:test` 下需要手动实现 fake timer，比较麻烦。

---

### ❌ I2：缺少集成测试和 E2E 测试类别

当前只有：
- **Unit tests**：测试纯函数
- **Component tests**：用 fake pi process 测试 session 逻辑

**缺失**：
- **Integration tests**：实际 spawn pi 进程（或 mock binary）测试 RPC 协议
- **E2E tests**：完整的 ACP stdio 会话流程

smoke 脚本（`scripts/smoke-*.mjs`）填补了部分 E2E 需求，但它们：
1. 需要真实的 pi 安装和有效的 API key
2. 不是自动化 pass/fail 的（依赖人工观察输出）
3. 不在 CI 流水线中运行

---

### ❌ I3：`fakes.ts` 的 `FakePiProcess` 不够全面

```typescript
// test/helpers/fakes.ts（57 行）
export function makeFakePiProcess(events: PiRpcEvent[]): FakePiProcess
```

当前 fake 不支持：
- 模拟特定 RPC 命令的失败（`getState` 成功但 `prompt` 失败）
- 控制事件发出的时机（同步 vs 异步）
- 模拟进程崩溃（mid-stream exit）
- 模拟 stderr 输出
- 断言 RPC 命令被发出（spy 功能）

---

## 三、构建配置问题

### 🟡 B1：`tsconfig.json` 缺少严格检查选项

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    // 缺少以下：
    // "noUncheckedIndexedAccess": true,
    // "exactOptionalPropertyTypes": true,
    // "noImplicitOverride": true
  }
}
```

`strict: true` 已经包含 `noImplicitAny` 等，但 `noUncheckedIndexedAccess` 可以捕捉大量 `any` 类型访问模式。

---

### 🟡 B2：`tsup.config.ts` target 与 `package.json` engines 不一致

```typescript
// tsup.config.ts
target: 'node22'    // 以 Node.js 22 为编译目标
```

```json
// package.json
"engines": { "node": ">=20" }   // 声称支持 Node.js 20+
```

以 node22 为 target 会使用 Node.js 22 的 API，而 `engines` 声称支持 Node.js 20。应保持一致（统一为 node20 或将 engines 改为 `>=22`）。

---

### 🟡 B3：构建产物不包含类型声明

```typescript
// tsup.config.ts
dts: false   // 不生成 .d.ts 文件
```

虽然这个包是一个 CLI 工具（通过 `bin` 字段使用），不需要类型声明供外部消费。但如果将来需要暴露 API，要记得开启此选项。

---

### 🟢 B4（良好）：构建流程干净

- `tsup` 配置简洁，使用 ESM 输出
- `prepack` 自动构建
- `prepublishOnly` 自动测试后构建
- sourcemap 已启用，便于调试

---

## 四、CI/CD 问题

### ❌ CI1：发布流程缺少关键检查

```yaml
# .github/workflows/npm-publish.yml
- run: npm ci
- run: npm run build --if-present
- run: npm test
- run: npm publish --provenance
```

**缺少**：
- `npm run typecheck`（`tsc --noEmit`）：类型错误不阻断发布
- `npm run lint`：lint 错误不阻断发布
- Node.js 版本矩阵测试（只测 `24.x`，但 engines 声称支持 `>=20`）

---

### ❌ CI2：无 PR 检查工作流

只有发布工作流（`npm-publish.yml`）和 release 工作流（`github-release.yml`）。**没有** PR 的自动 lint + typecheck + test 检查。代码审查没有自动化辅助。

---

### ❌ CI3：发布由 `workflow_dispatch` 手动触发

```yaml
on:
  workflow_dispatch:
```

没有基于 tag 或 release 的自动发布。每次发布需要手动在 GitHub UI 触发。对于一个 npm 包来说，tag-triggered 发布更可靠。

---

## 五、Smoke 测试问题

### 🟡 SM1：smoke 测试不可自动化

所有 `scripts/smoke-*.mjs` 脚本：
- 需要真实运行的 pi 实例
- 需要有效的 API key（真实 LLM 调用）
- 输出是流式文本，需要人工判断是否正确
- 不在 CI 中运行

它们有调试价值，但无法作为回归测试使用。

---

## 六、总结优先级

| 优先级 | ID | 问题 | 影响 |
|--------|----|------|------|
| 🔴 高 | C1 | `process.ts` 核心路径零测试 | RPC 超时、并发、dispose 无保障 |
| 🔴 高 | C2 | 只测 happy path | 错误路径静默退化 |
| 🔴 高 | CI1 | 发布前无 typecheck/lint | 带类型错误的版本可能发布 |
| 🟡 中 | CI2 | 无 PR 检查工作流 | 代码质量无自动门控 |
| 🟡 中 | I1 | `node:test` 难以测试超时逻辑 | 阻碍 R1 的测试补充 |
| 🟡 中 | I3 | `fakes.ts` 不支持错误场景 | 无法测试 crash、timeout |
| 🟡 中 | B2 | target 与 engines 版本不一致 | 运行时兼容性风险 |
| 🟢 低 | CI3 | 手动触发发布 | 操作便利性 |
| 🟢 低 | B1 | 缺少额外严格 TS 选项 | 类型检查遗漏 |
