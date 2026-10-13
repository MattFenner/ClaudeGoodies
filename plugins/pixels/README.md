# pixels plugin

A Claude Code mod that draws a timeline of the session above the prompt, one cell per second of activity, and adds a `/spans` pane with the details. See the [repo README](../../README.md) for more.

## Install

```
/plugin install pixels --marketplace MattFenner/ClaudeGoodies
```

## What it does

- **The bar:** a row above the prompt, `events -> spans -> grid`. Each span (a tool call, a model request, a prompt) takes one cell per second of duration, at least one. It shows the most recent cells that fit the terminal, cut on the left. Colour says what it was: blue for tools, green for MCP, white for you, dark grey for the assistant.
- **The pane:** `/spans` opens or closes a pane listing every span since your last prompt, oldest first, with detail lines under each (model, tokens, cost, the tool's command or path, the prompt text). The engine scrolls it.
- **The logs:** every telemetry event is written to `logs/<session-id>.jsonl` in the plugin folder, one file per session, and files older than 7 days are deleted. Identifying attributes (email, account, organization, session id) are dropped before anything is stored.

Telemetry redacts prompt text and tool arguments, so the plugin hooks `prompt.submit` and `tool.call` to learn them. Those are kept in memory for the pane and are never written to the log files.

## Layout

```
plugins/pixels/
├── .claude-plugin/plugin.json   manifest
├── hooks/
│   ├── hooks.json               points at register.tsx
│   ├── register.tsx             the hooks, the state atoms, writing and pruning the logs (the only file that touches `$`)
│   ├── events.ts                telemetry entry -> stored event, dropping identifying attributes
│   ├── spans.ts                 events -> spans (pairs tool calls, drops background model calls)
│   ├── grid.ts                  spans -> cells, styles, packing for the Raster
│   ├── details.ts               a span -> a pane row and its detail lines
│   ├── tools.ts                 summaries of tool calls and prompts for the pane
│   ├── log.ts                   log file contents and which files are stale
│   └── *.test.ts                a test file beside each
└── types/index.d.ts             the event, span-adjacent types and the $.state contract
```

Everything except `register.tsx` is plain functions, because the engine will not follow `$` into another file.

## Run it live

From the repo root:

```bash
claude --plugin-dir ./plugins/pixels
```

Claude Code hot-reloads on save. Use `/spans` to open the pane.

## Check your work

```bash
scripts/check.sh pixels
```

Types are written by Claude Code when it loads the plugin (see the [todo plugin README](../todo/README.md#set-up-types-once-per-machine)).
