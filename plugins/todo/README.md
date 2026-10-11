# todo plugin

A Claude Code mod that keeps a persistent todo list, shows it in a Todos pane, adds a `/todo` command, and gives Claude a `todos` tool. See the [repo README](../../README.md) for more.

## Install

```
/plugin install todo --marketplace MattFenner/ClaudeGoodies
```

## Layout

```
plugins/todo/
├── .claude-plugin/plugin.json   manifest (name, version, types path)
├── hooks/
│   ├── hooks.json               points at register.tsx
│   ├── register.tsx             state, storage, hooks, the todos tool
│   ├── ui.tsx                   pure pane drawing (no engine calls)
│   └── list.ts                  pure todo helpers (no engine calls)
├── tests/todo.test.tsx          pane test, run with `claude plugin test`
└── types/index.d.ts             the todo type and the $.state contract
```

At the repo root, `scripts/check.sh` validates, tests and type-checks the plugins.

## Run it live

From the repo root, start an interactive session with the plugin loaded straight from this folder:

```bash
claude --plugin-dir ./plugins/todo
```

Claude Code watches the folder and hot-reloads the mod when you save a file, so there is nothing to copy. Use `/todo` to open the pane, or ask Claude to use the `todos` tool.

## Set up types (once per machine)

Claude Code writes the type declarations for your version when it loads the plugin, so they are not committed. Run the plugin live once from the repo root (see above) in an interactive session. It writes `plugins/todo/.claude-plugin/types/` (git-ignored): the declarations (`claude-code`, `claude-code-tools`, `claude-code-mcp`) and a `tsconfig.json`.

`plugins/todo/tsconfig.json` is committed. It extends that generated config, so your editor and `tsc` resolve `claude-code` once the types exist.

Run the plugin live again after you update Claude Code, to refresh them.

## Check your work

```bash
scripts/check.sh          # all plugins: validate, test, then tsc
scripts/check.sh todo     # one plugin
```

Or one step at a time:

```bash
claude plugin validate plugins/todo
claude plugin test plugins/todo
npx -y -p typescript@5.6.3 tsc -p plugins/todo/tsconfig.json
```

`validate` may print warnings or advice; it should not print errors.

## Where the data lives

Todos are saved with `$.store` under the key `todos`. Claude Code keeps the store between sessions and hot reloads as a JSON file under `~/.claude/plugins/store/`, named for the plugin. The docs don't say whether the store survives a plugin update or reinstall, so don't rely on that. Tests replace `store.set` with a hook, so they never touch your real list.

## Engine rules that shape the code

The engine enforces these when it loads a mod. Breaking them stops the mod loading:

- A state owner must be the plugin's own name. The `todo` atom in `register.tsx`, the `PluginState` key in `types/index.d.ts` and the tool name `mcp__todo__todos` all use `todo`; renaming the plugin means changing them together.
- Pass `$` only to functions declared in the same file. `register.tsx` owns every call that takes `$`. `ui.tsx` and `list.ts` stay pure.
- Declare each state atom in the file that reads or writes it.
- Use literal `plugin` and `key` values in state references.
