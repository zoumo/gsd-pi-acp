# gsd-pi-acp

ACP ([Agent Client Protocol](https://agentclientprotocol.com/overview/introduction)) adapter for [`gsd`](https://github.com/svkozak/gsd-pi-acp) and [`pi`](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) coding agents with **dual backend support**.

> **Fork notice**: This project is forked from [svkozak/gsd-pi-acp](https://github.com/svkozak/gsd-pi-acp) at version 0.0.24. See [CHANGELOG](docs/CHANGELOG.md) for changes since the upstream baseline.

`gsd-pi-acp` communicates **ACP JSON-RPC 2.0 over stdio** to an ACP client (e.g. Zed editor) and spawns either `gsd --mode rpc` or `pi --mode rpc`, bridging requests/events between the two.

## Dual Backend Support

`gsd-pi-acp` automatically detects which backend to use at startup:

1. **Auto-detection** (default): Tries `gsd` first, falls back to `pi` if gsd is not available
2. **Explicit override**: Set `PI_ACP_PI_COMMAND` environment variable to force a specific backend:
   - `PI_ACP_PI_COMMAND=gsd` - use gsd backend
   - `PI_ACP_PI_COMMAND=pi` - use pi backend
   - `PI_ACP_PI_COMMAND=/path/to/custom/binary` - use custom binary

**Session storage differs by backend:**
- gsd backend: sessions stored in `~/.gsd/sessions/<cwd-hash>/`
- pi backend: sessions stored in `~/.pi/agent/sessions/...`

## Status

This is an MVP-style adapter intended to be useful today and easy to iterate on. Some ACP features may be not implemented or are not supported (see [Limitations](#limitations)). Development is centered around [Zed](https://zed.dev) editor support, other clients may have varying levels of compatibility.

## Features

- Streams assistant output as ACP `agent_message_chunk`
- Maps gsd/pi tool execution to ACP `tool_call` / `tool_call_update`
  - Tool call locations are surfaced when available for ACP clients that support opening the referenced file/context
  - Relative file paths from gsd/pi are resolved against the session cwd before being emitted as ACP tool locations, which enables follow-along features in clients like Zed
  - For `edit`, `gsd-pi-acp` attempts to infer a 1-based line number from a unique `oldText` match in the pre-edit file snapshot and includes it in the emitted tool location when possible
  - For `edit`, `gsd-pi-acp` snapshots the file before the tool runs and emits an ACP **structured diff** (`oldText`/`newText`) on completion when possible
- Session persistence
  - gsd backend: sessions stored in `~/.gsd/sessions/<cwd-hash>/`
  - pi backend: sessions stored in `~/.pi/agent/sessions/...`
  - `gsd-pi-acp` stores a small session mapping file so `session/load` can reattach to previous sessions
- Slash commands
  - Loads file-based slash commands compatible with gsd/pi conventions
  - Adds a small set of built-in commands for headless/editor usage
  - Supports skill commands (if enabled in backend settings, they appear as `/skill:skill-name` in the ACP client)
- Skills are loaded by gsd/pi directly and are available in ACP sessions
- MCP servers provided by ACP clients are written to `<cwd>/.gsd/mcp.json` for the gsd backend
- (Zed) `gsd-pi-acp` emits "startup info" block into the session (backend version, context, skills, prompts, extensions). You can disable it by setting `quietStartup: true` in backend settings (`~/.gsd/settings.json` or `~/.pi/agent/settings.json` or project-level settings). When `quietStartup` is enabled, `gsd-pi-acp` will still emit a 'New version available' message if the installed backend version is outdated.
- (Zed) Session history is supported in Zed starting with [`v0.225.0`](https://zed.dev/releases/preview/0.225.0). Session loading / history maps to backend session files. Sessions can be resumed both in `gsd`/`pi` and in the ACP client.

## Prerequisites

- Node.js 20+
- `gsd` or `pi` installed and available on your `PATH` (the adapter auto-detects which is available)
- Configure your backend separately for model providers/API keys

Install gsd:
```bash
npm install -g gsd-pi@latest
```

Or install pi:
```bash
npm install -g @mariozechner/pi-coding-agent
```

## Install

### From source (this fork)

```bash
git clone <this-repo>
cd gsd-pi-acp
npm install
npm run build
```

Point your ACP client to the built `dist/index.js`:

```json
  "agent_servers": {
    "gsd-pi": {
      "type": "custom",
      "command": "node",
      "args": ["/path/to/gsd-pi-acp/dist/index.js"],
      "env": {}
    }
  }
```

### Slash commands

`gsd-pi-acp` supports slash commands:

#### 1) File-based commands (aka prompts)

Loaded from (depending on backend):

- gsd user commands: `~/.gsd/prompts/**/*.md`
- gsd project commands: `<cwd>/.gsd/prompts/**/*.md`
- pi user commands: `~/.pi/agent/prompts/**/*.md`
- pi project commands: `<cwd>/.pi/prompts/**/*.md`

#### 2) Built-in commands

- `/compact [instructions...]` - run compaction (optionally with custom instructions)
- `/autocompact on|off|toggle` - toggle automatic compaction
- `/export` - export the current session to HTML in the session `cwd`
- `/session` - show session stats (tokens/messages/cost/session file)
- `/name <name>` - set session display name
- `/steering` - maps to Steering Mode, get/set
- `/follow-up` - maps to Follow-up Mode, get/set

Other built-in commands:

- `/model` - maps to model selector in Zed
- `/thinking` - maps to 'mode' selector in Zed
- `/clear` - not implemented (use ACP client 'new' command)

#### 3) Skill commands

- Skill commands can be enabled in backend settings and will appear in the slash command list in ACP client as `/skill:skill-name`.

**Note**: Slash commands provided by extensions are not currently supported.

## Debug Logging

Debug logging is opt-in via environment variable:

```bash
PI_ACP_DEBUG_LOG=1
```

Log file: `~/.gsd/gsd-pi-acp/debug-{pid}-{YYYY-MM-DD}.log`

Override path: `PI_ACP_DEBUG_LOG_PATH=/absolute/path/to/log`

Logs include: startup, backend detection, session lifecycle, RPC calls, subprocess stderr, errors, shutdown.

## Authentication (ACP Registry support)

This agent supports **Terminal Auth** for the [ACP Registry](https://agentclientprotocol.com/get-started/registry).
In Zed, this will show an **Authenticate** banner that launches gsd or pi in a terminal.
Launch your backend in a terminal for interactive login/setup:

```bash
gsd-pi-acp --terminal-login
```

Your ACP client can also invoke this automatically based on the agent's advertised `authMethods`.

## Development

```bash
npm install
npm run dev        # run from src via tsx
npm run build
npm run lint
npm run test       # 134 tests
```

Project layout:

- `src/acp/*` - ACP server + translation layer
- `src/pi-rpc/*` - gsd/pi subprocess wrapper (RPC protocol)
- `src/backend/*` - Backend configuration (gsd vs pi detection)
- `src/logger.ts` - Debug logger
- `src/stdout-writer.ts` - Stdout write helper

## Limitations

- No ACP filesystem delegation (`fs/*`) and no ACP terminal delegation (`terminal/*`). gsd/pi reads/writes and executes locally.
- MCP servers are written to `.gsd/mcp.json` for gsd backend; pi backend does not support MCP pass-through.
- Assistant streaming is currently sent as `agent_message_chunk` (no separate thought stream).

## License

MIT (see [LICENSE](LICENSE)).
