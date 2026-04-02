# GSD 适配方案

> 目标：将 `pi-acp` 适配为 `gsd-acp`，即将 `pi --mode rpc` 替换为 `gsd --mode rpc`
> 基于对 GSD（`gsd-pi` v2.58.0）的实际逆向分析

---

## 一、关键差异对比

| 维度 | pi（原版） | GSD（目标） |
|------|-----------|------------|
| 可执行文件 | `pi` / `pi.cmd` | `gsd` / `gsd-cli` |
| agent 目录 | `~/.pi/agent/` | `~/.gsd/agent/` |
| 目录覆盖环境变量 | `PI_CODING_AGENT_DIR` | `GSD_HOME`（覆盖整个 `~/.gsd`） |
| session 存储根目录 | `~/.pi/agent/sessions/` | `~/.gsd/sessions/` |
| session 目录结构 | 平铺或未知 | 按 cwd 哈希分目录（`--Users-jim-...--/` 格式） |
| 项目级配置目录 | `.pi/` | `.gsd/`（推测，需验证） |
| auth 文件 | `~/.pi/agent/auth.json` | `~/.gsd/agent/auth.json` |
| models 文件 | `~/.pi/agent/models.json` | `~/.gsd/agent/models.json`（有 pi 迁移回退） |
| `--no-themes` 标志 | 支持 | **不支持**（GSD 无此参数） |
| quiet startup | 由 `settings.json` 控制 | GSD **始终** quiet startup（强制写入 settings） |
| 适配器存储目录 | `~/.pi/pi-acp/` | 应改为 `~/.gsd/gsd-acp/` |
| 包名 / bin 名 | `pi-acp` | `gsd-acp` |
| auth method ID | `pi_terminal_login` | `gsd_terminal_login` |

---

## 二、需要修改的文件清单

### 2.1 `src/pi-rpc/command.ts` — 二进制名称

```typescript
// ❌ 当前
export function defaultPiCommand(): string {
  return platform() === 'win32' ? 'pi.cmd' : 'pi'
}

export function getPiCommand(override?: string): string {
  return override ?? defaultPiCommand()
}
```

```typescript
// ✅ 修改后
export function defaultGsdCommand(): string {
  return platform() === 'win32' ? 'gsd-cli.cmd' : 'gsd'
}

export function getGsdCommand(override?: string): string {
  return override ?? defaultGsdCommand()
}
```

---

### 2.2 `src/pi-rpc/process.ts` — spawn 参数

```typescript
// ❌ 当前：使用了 pi-specific 的 --no-themes 标志
const args = ['--mode', 'rpc', '--no-themes']
if (params.sessionPath) args.push('--session', params.sessionPath)
```

```typescript
// ✅ 修改后：GSD 不支持 --no-themes，GSD 始终 quiet startup
const args = ['--mode', 'rpc']
// 注意：GSD 通过 gsd --continue 或 sessionManager 传递 session 路径，
// 待确认 GSD 的 --session 标志是否存在
if (params.sessionPath) args.push('--session', params.sessionPath)
```

> ⚠️ **待确认**：GSD 的 `--mode rpc` 是否支持 `--session <path>` 参数？
> 当前 GSD cli 用 `_selectedSessionPath` 管理 session，需要实测。

---

### 2.3 `src/acp/paths.ts` — 适配器存储路径

```typescript
// ❌ 当前
export function getPiAcpDir(): string {
  return join(homedir(), '.pi', 'pi-acp')
}

export function getPiAcpSessionMapPath(): string {
  return join(getPiAcpDir(), 'session-map.json')
}
```

```typescript
// ✅ 修改后
export function getGsdAcpDir(): string {
  const gsdHome = process.env.GSD_HOME ?? join(homedir(), '.gsd')
  return join(gsdHome, 'gsd-acp')
}

export function getGsdAcpSessionMapPath(): string {
  return join(getGsdAcpDir(), 'session-map.json')
}
```

---

### 2.4 `src/pi-auth/status.ts` — 认证检测

```typescript
// ❌ 当前：读取 ~/.pi/agent/auth.json
export function getPiAgentDir(): string {
  const envDir = process.env.PI_CODING_AGENT_DIR
  if (envDir) { ... }
  return join(homedir(), '.pi', 'agent')
}
```

```typescript
// ✅ 修改后：读取 ~/.gsd/agent/auth.json
export function getGsdAgentDir(): string {
  const gsdHome = process.env.GSD_HOME ?? join(homedir(), '.gsd')
  return join(gsdHome, 'agent')
}
```

GSD 的 `auth.json` 路径由 `app-paths.js` 中的 `authFilePath = join(agentDir, 'auth.json')` 确定，其中 `agentDir = join(appRoot, 'agent')`，`appRoot = process.env.GSD_HOME || join(homedir(), '.gsd')`。

`hasAnyPiAuthConfigured()` 函数的逻辑整体可以复用，只需修改路径来源：
- `auth.json` → `~/.gsd/agent/auth.json`
- `models.json` → `~/.gsd/agent/models.json`（GSD 的 `models.json` 有 `.pi` 迁移回退，可忽略）
- 环境变量列表：可完整复用（API key 检测是通用的）

---

### 2.5 `src/acp/pi-settings.ts` — 配置读取路径

```typescript
// ❌ 当前：读取 .pi/settings.json 和 ~/.pi/agent/settings.json
const projectSettingsPath = resolve(cwd, '.pi', 'settings.json')
export function getAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR
    ? resolve(process.env.PI_CODING_AGENT_DIR)
    : join(homedir(), '.pi', 'agent')
}
```

```typescript
// ✅ 修改后：读取 .gsd/settings.json 和 ~/.gsd/agent/settings.json
const projectSettingsPath = resolve(cwd, '.gsd', 'settings.json')
export function getGsdAgentDir(): string {
  const gsdHome = process.env.GSD_HOME ?? join(homedir(), '.gsd')
  return join(gsdHome, 'agent')
}
```

---

### 2.6 `src/acp/pi-sessions.ts` — Session 文件扫描

这是**最复杂的适配点**。GSD 的 session 目录结构与 pi 不同：

**Pi session 路径**（推测）：`~/.pi/agent/sessions/*.jsonl`（平铺）

**GSD session 路径**（实测确认）：
```
~/.gsd/sessions/
  --Users-jim-code-zoumo-gsd-pi-acp--/
    2026-04-02T14-13-06-547Z_3f03415e-861c-437c-b5a6-2b589f6c73fa.jsonl
  --Users-jim-code-github-agent-gsd-2--/
    *.jsonl
```

目录名的生成规则：cwd 路径中 `/` 替换为 `-`，两端加 `--`。

**JSONL 头部结构**（实测）：
```json
{
  "type": "session",
  "version": 3,
  "id": "3f03415e-861c-437c-b5a6-2b589f6c73fa",
  "timestamp": "2026-04-02T14:13:06.547Z",
  "cwd": "/Users/jim/code/zoumo/gsd-pi-acp"
}
```

第二行通常是 `model_change` 事件（含 provider 和 modelId）。

**需要修改**：
1. `getGsdAgentDir()` 路径：`~/.gsd/sessions/` 而非 `~/.pi/agent/sessions/`
2. 目录扫描逻辑：GSD session 在按 cwd 分的子目录中，需要两层目录遍历
3. `findPiSessionFile()` 的目录解析逻辑：按 cwd 哈希目录名匹配

```typescript
// ✅ GSD session 目录路径
function getGsdSessionsBaseDir(): string {
  const gsdHome = process.env.GSD_HOME ?? join(homedir(), '.gsd')
  return join(gsdHome, 'sessions')
}

// ✅ 从 cwd 生成 GSD 目录名（逆向自 migrateLegacyFlatSessions 逻辑）
function cwdToGsdDirName(cwd: string): string {
  return '--' + cwd.replace(/\//g, '-') + '--'
}

// ✅ 直接定位某个 cwd 的 session 目录
function getGsdProjectSessionsDir(cwd: string): string {
  return join(getGsdSessionsBaseDir(), cwdToGsdDirName(cwd))
}
```

---

### 2.7 `src/acp/slash-commands.ts` — 用户 prompts 目录

```typescript
// ❌ 当前
const userDir = join(homedir(), '.pi', 'agent', 'prompts')
const projectDir = resolve(cwd, '.pi', 'prompts')
```

```typescript
// ✅ 修改后
const gsdHome = process.env.GSD_HOME ?? join(homedir(), '.gsd')
const userDir = join(gsdHome, 'agent', 'prompts')
const projectDir = resolve(cwd, '.gsd', 'prompts')
```

---

### 2.8 `src/acp/agent.ts` — 多处硬编码路径

```typescript
// ❌ agent.ts 中多处硬编码 ~/.pi/ 路径（第 1276、1287、1298、1308 行）
const projectSkillsDir = join(opts.cwd, '.pi', 'skills')
const promptsDir = join(process.env.HOME ?? '', '.pi', 'agent', 'prompts')
const extDir = join(process.env.HOME ?? '', '.pi', 'agent', 'extensions')
const settingsPath = join(process.env.HOME ?? '', '.pi', 'agent', 'settings.json')
```

```typescript
// ✅ 修改后（同时修复 HOME 降级问题，统一用 os.homedir()）
const gsdHome = process.env.GSD_HOME ?? join(homedir(), '.gsd')
const projectSkillsDir = join(opts.cwd, '.gsd', 'skills')
const promptsDir = join(gsdHome, 'agent', 'prompts')
const extDir = join(gsdHome, 'agent', 'extensions')
const settingsPath = join(gsdHome, 'agent', 'settings.json')
```

---

### 2.9 `src/acp/auth.ts` — Auth Method ID 和 Terminal Auth

```typescript
// ❌ 当前
export const PI_SETUP_METHOD_ID = 'pi_terminal_login'
// ...
method._meta = {
  'terminal-auth': { ...launch, label: 'Launch pi' }
}

// auth fallback
return { command: 'pi-acp', args: ['--terminal-login'] }
```

```typescript
// ✅ 修改后
export const GSD_SETUP_METHOD_ID = 'gsd_terminal_login'
// ...
method._meta = {
  'terminal-auth': { ...launch, label: 'Launch gsd' }
}

// auth fallback
return { command: 'gsd-acp', args: ['--terminal-login'] }
```

Terminal login 的实际命令也需要更新（`src/index.ts`）：
```typescript
// 当前：spawn pi 进入 interactive 模式做 auth
// GSD：spawn gsd config 进入配置向导
spawnSync('gsd', ['config'], { stdio: 'inherit' })
```

---

### 2.10 `src/acp/agent.ts` — agentInfo 和元信息

```typescript
// ❌ 当前
name: pkg.name ?? 'pi-acp',      // → 'gsd-acp'
title: 'pi ACP adapter',          // → 'GSD ACP adapter'

// piAcp 元数据 key（第 252、927 行）
_meta: { piAcp: { ... } }         // → { gsdAcp: { ... } }
```

```typescript
// 错误消息中的 npm 包名（src/pi-rpc/process.ts）
`Install it via \`npm install -g @mariozechner/pi-coding-agent\``
// → 'Install gsd via `npm install -g gsd-pi` or ensure `gsd` is on your PATH.'
```

---

### 2.11 `src/index.ts` — 环境变量名称

```typescript
// ❌ 当前
const cmd = getPiCommand(process.env.PI_ACP_PI_COMMAND)
// ...
piCommand: process.env.PI_ACP_PI_COMMAND
```

```typescript
// ✅ 修改后
const cmd = getGsdCommand(process.env.GSD_ACP_GSD_COMMAND)
// ...
gsdCommand: process.env.GSD_ACP_GSD_COMMAND
```

---

### 2.12 `package.json` — 包标识

```json
{
  "name": "gsd-acp",
  "description": "ACP adapter for GSD coding agent",
  "bin": {
    "gsd-acp": "dist/index.js"
  },
  "keywords": [
    "acp", "agent-client-protocol", "gsd", "gsd-pi", "adapter"
  ],
  "repository": {
    "url": "https://github.com/zoumo/gsd-acp.git"
  }
}
```

---

## 三、GSD 特有行为差异处理

### 3.1 `--no-themes` 参数不存在

`src/pi-rpc/process.ts` 中：
```typescript
const args = ['--mode', 'rpc', '--no-themes']  // ← GSD 不支持此参数
```

GSD 中 themes 通过 `packages` 数组在 `settings.json` 中管理，不存在 `--no-themes` 标志。

**处理方案**：直接移除 `'--no-themes'`。

---

### 3.2 GSD 始终 quiet startup

GSD `cli.js` 中：
```javascript
// GSD always uses quiet startup — the gsd extension renders its own branded header
if (!settingsManager.getQuietStartup()) {
  settingsManager.setQuietStartup(true)
}
```

这意味着 `src/acp/pi-settings.ts` 中的 `getQuietStartup()` 函数在 GSD 中**始终返回 true**。`buildStartupInfo()` 的触发逻辑需要相应调整：

```typescript
// 当前逻辑：quietStartup=false 时才合成 startup info
if (!getQuietStartup(params.cwd)) {
  // emit startup info
}
// GSD 中：因为始终 quiet，startup info 将永远不被发送
// → 可能需要反转逻辑，或直接无条件发送 GSD 版本的 startup info
```

---

### 3.3 Session 目录扫描效率优化机会

GSD 按 cwd 将 session 存储在分目录中，这实际上消除了 `listPiSessions()` 全量扫描的必要性：

- `listSessions(cwd)` 时：只需扫描 `~/.gsd/sessions/<cwd-hash>/` 这一个目录
- `findSessionFile(sessionId)` 时：如果知道 cwd，直接定位目录

这是从 O(全部 session) 降低到 O(该 cwd 的 session) 的重要优化机会。

---

### 3.4 `getAgentDir()` 重复定义问题

当前代码中，`getAgentDir()` / `getPiAgentDir()` 在两处各自独立定义：
- `src/acp/pi-settings.ts`（用于 settings 路径）
- `src/pi-auth/status.ts`（用于 auth 路径）

适配时应合并为统一的 `getGsdAgentDir()` 工具函数，放在 `src/gsd-paths.ts` 或 `src/acp/paths.ts` 中。

---

## 四、需要实测验证的不确定点

| 待验证项 | 验证方法 | 预期结果 |
|---------|---------|---------|
| GSD RPC 是否支持 `--session <path>` 参数 | `gsd --mode rpc --session /tmp/test.jsonl` | 确认参数是否有效 |
| GSD RPC 的事件格式是否与 pi 相同 | 启动 `gsd --mode rpc`，发送 `get_state`，观察响应 | 字段名称一致 |
| GSD 项目级 settings 是否在 `.gsd/settings.json` | 在 cwd 创建 `.gsd/settings.json`，启动 gsd 验证 | 与 pi 的 `.pi/settings.json` 对应 |
| GSD 的 `preludeLines` 格式 | 启动 `gsd --mode rpc`，观察 NDJSON 前的 stderr 输出 | 可能为空（始终 quiet） |
| Windows 下 gsd 的命令名 | 在 Windows 上检查 npm 安装的 bin 文件 | 可能是 `gsd-cli.cmd` |

---

## 五、需要新增的 GSD 特有功能

### 5.1 GSD Worktree 支持

GSD 有 worktree 特性（`gsd --worktree`），pi 没有。ACP 适配器可以考虑：
- 新增 `/worktree` slash 命令
- 在 `newSession` 时支持传入 `worktree` 参数

（MVP 阶段可暂不实现）

### 5.2 GSD Sessions 子命令

GSD 有 `gsd sessions` 子命令列出历史 session。这已通过 ACP 的 `listSessions` 覆盖，无需额外处理。

### 5.3 `GSD_VERSION` 环境变量

GSD 通过 `process.env.GSD_VERSION` 获取自身版本（见 `cli.js`）。适配器的版本检查应使用此变量而非 `spawnSync('gsd', ['--version'])`。

---

## 六、改动工作量估算

| 改动类型 | 文件数 | 估计工作量 |
|---------|--------|-----------|
| 机械替换（路径/名称/env var） | 8 个文件 | 1-2 小时 |
| session 扫描逻辑重写（目录结构差异） | 1 个文件 | 2-3 小时 |
| quiet startup 逻辑调整 | 1 个文件 | 0.5 小时 |
| `--no-themes` 移除 | 1 个文件 | 10 分钟 |
| auth 流程验证与调整 | 2 个文件 | 1-2 小时 |
| 测试更新（所有 fake/fixture 路径） | 10+ 个文件 | 3-4 小时 |
| package.json + README 更新 | 2 个文件 | 30 分钟 |
| **合计** | | **约 2 天** |

---

## 七、推荐改动顺序

1. **先做路径统一**：新建 `src/gsd-paths.ts`，汇总所有路径函数，修复 `HOME` 降级问题
2. **改 binary**：`command.ts` + `process.ts`（移除 `--no-themes`）
3. **改 session 扫描**：`pi-sessions.ts` 完整重写，利用 GSD 的目录结构提升性能
4. **改 auth**：`status.ts` + `auth.ts`
5. **改 settings**：`pi-settings.ts`
6. **改 agent.ts**：替换剩余所有硬编码路径
7. **改 package.json / index.ts**：名称、env var、错误消息
8. **更新所有测试** fixture 和 fake 中的路径
