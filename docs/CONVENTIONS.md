# Coding Conventions

> Auto-generated from GSD knowledge base. Do not edit directly.
> Last synced: 2026-04-07 (M003/S03)

## Rules

- **K001** [backend]: GSD spawn args must NOT include `--no-themes`. Pi spawn args include `--mode rpc --no-themes`. GSD only uses `--mode rpc`.
- **K002** [backend]: GSD uses cwd-scoped sessions at `~/.gsd/sessions/<cwd-hash>/`. Pi uses flat `~/.pi/agent/sessions/`. Session listing for GSD MUST pass cwd parameter.
- **K003** [backend]: GSD uses `~/.gsd` as agent dir (no 'agent' subdirectory). Pi uses `~/.pi/agent`.
- **K004** [backend]: GSD backend always has `quietStartup=true`. Pi reads from settings.json.
- **K005** [backend]: GSD skills: `~/.gsd/skills` + `<cwd>/.gsd/skills`. Pi skills: `~/.pi/agent/skills` + `~/.agents/skills` (legacy) + `<cwd>/.pi/skills`.
- **K006** [backend]: Both backends use `PI_ACP_PI_COMMAND` env var for command override. Backend inferred from command string. Agent dir override: `GSD_AGENT_DIR` for gsd, `PI_CODING_AGENT_DIR` for pi.
- **K007** [backend]: Session map path: GSD `~/.gsd/session-map.json`, Pi `~/.pi/pi-acp/session-map.json`.
- **K008** [backend]: Auto-detection tries `gsd` first, then `pi` fallback. Override with `PI_ACP_PI_COMMAND=pi`.
- **K012** [security]: Path validation: check absolute path + no traversal (`..`), NOT "within home directory". Allows `/tmp` for testing.
- **K019** [pattern]: readFileSync is correct in synchronous event handlers that need to capture file state at a precise moment. Async would break event ordering.
- **K020** [typescript]: Discriminated unions must not include catch-all `type: string` member — it breaks switch-based narrowing. Use `default:` case instead.

## Patterns

- **K009** [pattern]: Use getter functions (e.g., `getRpcTimeoutMs()`) instead of const for env-configurable values. Node.js module imports are cached; getter functions read env var on each call.
- **K010** [pattern]: RPC timeout: use `settled` boolean guard + wrapper functions to prevent double-resolve between timeout and process exit. Clear timer in all resolution paths.
- **K011** [pattern]: Direct instance capture for disposal — avoid SDK internal property access like `(agent as any)?.agent?.dispose?.()`. Capture the instance before passing to wrapper.
- **K014** [pattern]: Replace `as any` casts with Zod parsing. All schema fields optional for forward compatibility. `CommandsSchema` supports both string arrays and object arrays.
- **K015** [pattern]: Fire-and-forget async logging: wrap `fs.appendFile` in `.catch(() => {})`. Opt-in via env var. ISO timestamps.
- **K017** [architecture]: Extract focused modules with single responsibility. Clear imports/exports, tested via integration or dedicated unit tests.
- **K018** [pattern]: Dependency injection for SessionStore — pass single instance to constructor instead of dual instantiation.
- **K021** [pattern]: Legacy wrapper functions that use `as any` to fake config objects are a debt signal. Remove them once the new API is stable.
