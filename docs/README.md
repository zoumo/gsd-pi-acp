# pi-acp 项目深度审计报告

> 审计时间：2026-04-02
> 审计范围：`src/`（3,400 行）、`test/`（1,814 行）、`scripts/`、`.github/`
> 目标：指出代码中不合理之处，明确适配到 GSD 所需的全部工作

---

## 子报告索引

| 文档 | 覆盖维度 |
|------|---------|
| [audit-architecture.md](./audit-architecture.md) | 模块划分、职责分离、类型安全、代码质量 |
| [audit-robustness.md](./audit-robustness.md) | 安全性、进程健壮性、资源管理、可观测性 |
| [audit-testing.md](./audit-testing.md) | 测试覆盖率、测试质量、构建配置、CI/CD |
| [audit-acp-compliance.md](./audit-acp-compliance.md) | ACP 协议合规性、事件翻译完整性、auth 流程 |
| [gsd-adaptation.md](./gsd-adaptation.md) | GSD 适配方案，逐文件改动清单 |

---

## 顶层问题汇总

### 🔴 必须修复（Critical / High）

| # | 问题 | 文件 | 归类 |
|---|------|------|------|
| 1 | **RPC 请求无超时**，Promise 可永久挂起 | `pi-rpc/process.ts:293` | 健壮性 |
| 2 | **关闭逻辑依赖 SDK 私有属性** `(agent as any).agent`，静默失效后子进程泄漏 | `index.ts:61` | 健壮性 |
| 3 | **零日志**，3,400 行生产代码中无任何可观测性 | 全局 | 可观测性 |
| 4 | **`agent.ts` God Object**（1356 行），prompt() 方法 430 行，无法单测 | `acp/agent.ts` | 架构 |
| 5 | **`as any` 泛滥**（72 处），pi RPC 响应完全无类型保障 | 全局 | 类型安全 |
| 6 | **核心路径零测试**：`process.ts` 的 RPC 超时、并发、dispose | `test/` 缺失 | 测试 |
| 7 | **发布前无 typecheck/lint 检查**，带类型错误的版本可能发布 | `.github/workflows/` | CI/CD |
| 8 | **`authenticate` 无条件成功**，未验证 API key 有效性 | `acp/agent.ts` | ACP 合规 |

---

### 🟡 应该修复（Medium）

| # | 问题 | 文件 | 归类 |
|---|------|------|------|
| 9 | Turn 队列无深度限制，OOM 风险 | `acp/session.ts:216` | 健壮性 |
| 10 | `editSnapshots` Map 可无限增长（存储整个文件内容） | `acp/session.ts` | 资源管理 |
| 11 | `readline` 接口未在 `dispose()` 中显式关闭 | `pi-rpc/process.ts:98` | 资源管理 |
| 12 | `SessionStore` 双实例写同一文件，职责不清 | `agent.ts:104`, `session.ts:67` | 架构 |
| 13 | `buildStartupInfo`/`buildUpdateNotice` 混入协议层 | `acp/agent.ts:1128` | 架构 |
| 14 | `spawnSync` 在请求路径中阻塞事件循环（无 timeout） | `acp/agent.ts:1213` | 健壮性 |
| 15 | `pi-sessions.ts` 同步 FS 全量扫描阻塞事件循环 | `acp/pi-sessions.ts` | 性能 |
| 16 | 只测 happy path，错误路径（crash、timeout）无覆盖 | `test/` | 测试 |
| 17 | `tsup` target `node22` 与 `engines: >=20` 不一致 | `tsup.config.ts`, `package.json` | 构建 |
| 18 | `tool_approval_request` 未调用 `requestPermission` | `acp/session.ts` | ACP 合规 |
| 19 | 无 `unhandledRejection` 处理器 | `index.ts` | 健壮性 |
| 20 | `HOME ?? ''` 降级为根目录相对路径 | `acp/agent.ts:1276` | 正确性 |

---

### 🟢 可以改进（Low）

| # | 问题 | 文件 |
|---|------|------|
| 21 | SessionStore 从不剪枝旧条目 | `acp/session-store.ts` |
| 22 | `unstable_listSessions` 使用非标准 API 名 | `acp/agent.ts` |
| 23 | `setSessionMode` 只接受 `agent` 模式 | `acp/agent.ts` |
| 24 | 无 PR 自动检查工作流 | `.github/workflows/` |
| 25 | 完整 `process.env` 透传给子进程 | `pi-rpc/process.ts:138` |
| 26 | fire-and-forget setTimeout async 块 | `acp/agent.ts:265` |

---

## GSD 适配工作量估算

适配到 GSD 需要的改动（详见 [gsd-adaptation.md](./gsd-adaptation.md)）：

| 改动类别 | 涉及文件数 | 估计工时 |
|---------|-----------|---------|
| 路径/名称/env var 机械替换 | 8 个文件 | 1-2 小时 |
| Session 扫描逻辑重写（GSD 目录结构不同） | 1 个文件 | 2-3 小时 |
| `--no-themes` 移除 + quiet startup 调整 | 2 个文件 | 0.5 小时 |
| Auth 流程路径调整与验证 | 2 个文件 | 1-2 小时 |
| 测试 fixture 和 fake 路径更新 | 10+ 个文件 | 3-4 小时 |
| package.json / README 更新 | 2 个文件 | 0.5 小时 |
| **纯适配工作合计** | | **约 1-2 天** |

**关键路径差异**（最需要关注）：

1. `gsd` 的 agent 目录：`~/.gsd/agent/`（`GSD_HOME` 环境变量控制）
2. `gsd` 的 session 目录：`~/.gsd/sessions/<cwd-hash>/`（按 cwd 分目录，比 pi 更易定位）
3. `gsd` 不支持 `--no-themes` 标志
4. `gsd` 强制启用 quiet startup（不需要 settings 检查）
5. 项目级配置目录从 `.pi/` 改为 `.gsd/`

---

## 优先执行顺序建议

如果同时推进"修复问题"和"GSD 适配"，建议顺序：

```
阶段 1：基础修复（不依赖 GSD）
  ├─ 修复 index.ts 关闭逻辑（2 号问题）
  ├─ 给 RPC request() 加超时（1 号问题）
  ├─ 给 Turn 队列加深度限制（9 号问题）
  └─ 添加基础 stderr 日志（3 号问题）

阶段 2：GSD 适配（路径/名称替换）
  ├─ 新建 src/gsd-paths.ts（汇总所有路径函数）
  ├─ 修改 command.ts（gsd binary）
  ├─ 修改 process.ts（移除 --no-themes）
  ├─ 修改 auth/status.ts（GSD agent dir）
  ├─ 修改 pi-sessions.ts（GSD session 目录结构）
  └─ 修改 agent.ts、slash-commands.ts（剩余路径）

阶段 3：测试补充
  ├─ 补充 process.ts 的超时测试
  ├─ 更新所有 fixture 路径为 GSD 路径
  └─ 添加 CI PR 检查工作流

阶段 4：架构重构（非阻塞，可并行）
  ├─ 拆分 agent.ts God Object
  ├─ 为 pi RPC 响应添加 Zod 类型
  └─ 实现 requestPermission
```
