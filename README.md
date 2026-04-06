# gsd-pi-acp

ACP ([Agent Client Protocol](https://agentclientprotocol.com/overview/introduction)) adapter for [`gsd`](https://github.com/svkozak/gsd-pi-acp) and [`pi`](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) coding agents with **dual backend support**.

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

> **Note**: The pi backend remains fully supported. This rename reflects gsd-first auto-detection while maintaining backward compatibility for existing pi users.

## Status

This is an MVP-style adapter intended to be useful today and easy to iterate on. Some ACP features may be not implemented or are not supported (see [Limitations](#limitations)). Development is centered around [Zed](https://zed.dev) editor support, other clients may have varying levels of compatibility.

Expect some minor breaking changes.

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
- (Zed) `gsd-pi-acp` emits "startup info" block into the session (backend version, context, skills, prompts, extensions). You can disable it by setting `quietStartup: true` in backend settings (`~/.gsd/settings.json` or `~/.pi/agent/settings.json` or project-level settings). When `quietStartup` is enabled, `gsd-pi-acp` will still emit a 'New version available' message if the installed backend version is outdated.
- (Zed) Session history is supported in Zed starting with [`v0.225.0`](https://zed.dev/releases/preview/0.225.0). Session loading / history maps to backend session files. Sessions can be resumed both in `gsd`/`pi` and in the ACP client.

## Prerequisites

Make sure pi is installed

```bash
npm install -g @mariozechner/pi-coding-agent
```

- Node.js 22+
- `pi` installed and available on your `PATH` (the adapter runs the `pi` executable)
- Configure `pi` separately for your model providers/API keys

## Install

### Add pi-acp to your ACP client, e.g. [Zed](https://zed.dev/docs/agents/external-agents/)

#### Using ACP Registry in Zed or other clients that support it:

In Zed launch the registry with `zed: acp registry` command and select `pi ACP` adapter from the list. This will automatically add the agent server configuration to your `settings.json` and keep it up to date:

```json
  "agent_servers": {
    "pi-acp": {
      "type": "registry",
    },
  }
```

#### Using with `npx` (no global install needed, always loads the latest version):

Add the following to your Zed `settings.json`:

```json
  "agent_servers": {
    "pi": {
      "type": "custom",
      "command": "npx",
      "args": ["-y", "pi-acp"],
      "env": {}
    }
  }
```

#### Global install

```bash
npm install -g pi-acp
```

```json
  "agent_servers": {
    "pi": {
      "type": "custom",
      "command": "pi-acp",
      "args": [],
      "env": {}
    }
  }
```

#### From source

```bash
npm install
npm run build
```

Point your ACP client to the built `dist/index.js`:

```json
  "agent_servers": {
    "pi": {
      "type": "custom",
      "command": "node",
      "args": ["/path/to/pi-acp/dist/index.js"],
      "env": {}
    }
  }
```

### Slash commands

`pi-acp` supports slash commands:

#### 1) File-based commands (aka prompts)

Loaded from:

- User commands: `~/.pi/agent/prompts/**/*.md`
- Project commands: `<cwd>/.pi/prompts/**/*.md`

#### 2) Built-in commands

- `/compact [instructions...]` - run pi compaction (optionally with custom instructions)
- `/autocompact on|off|toggle` - toggle automatic compaction
- `/export` - export the current session to HTML in the session `cwd`
- `/session` - show session stats (tokens/messages/cost/session file)
- `/name <name>` - set session display name
- `/queue all|one-at-a-time` - set pi queue mode (unstable feature)
- `/changelog` - print the installed pi changelog (best-effort)
- `/steering` - maps to `pi` Steering Mode, get/set
- `/follow-up` - pats to `pi` Follow-up Mode, get/set

Other built-in commands:

- `/model` - maps to model selector in Zed
- `/thinking` - maps to 'mode' selector in Zed
- `/clear` - not implemented (use ACP client 'new' command)

#### 3) Skill commands

- Skill commands can be enabled in pi settings and will appear in the slash command list in ACP client as `/skill:skill-name`.

**Note**: Slash commands provided by pi extensions are not currently supported.

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
npm run test
```

Project layout:

- `src/acp/*` - ACP server + translation layer
- `src/pi-rpc/*` - gsd/pi subprocess wrapper (RPC protocol)
- `src/backend/*` - Backend configuration (gsd vs pi detection)

## Limitations

- No ACP filesystem delegation (`fs/*`) and no ACP terminal delegation (`terminal/*`). pi reads/writes and executes locally.
- MCP servers are accepted in ACP params and stored in session state, but not wired through to pi (see [why](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)). If you use [pi MCP adapter](https://github.com/nicobailon/pi-mcp-adapter) it will be available in the ACP client.
- Assistant streaming is currently sent as `agent_message_chunk` (no separate thought stream).
- Queue is implemented client-side and should work like pi's `one-at-a-time`
- ~~ACP clients don't yet suport session history, but ACP sessions from `pi-acp` can be `/resume`d in pi directly~~

## License

MIT (see [LICENSE](LICENSE)).
