# ClaudeGoodies
Claude plugins and other goodies

## Plugins

### todo

A persistent todo list with a panel, a `/todo` command, and a tool Claude can use to manage it. Todos are saved between sessions in the plugin's store.

Install it:

```bash
/plugin marketplace add MattFenner/ClaudeGoodies
/plugin install todo --marketplace MattFenner/ClaudeGoodies
```

### turn-pixels

A timeline above the prompt with one cell per second of each tool call, model request and prompt, plus a `/spans` pane with the details. Session logs are kept for 7 days.

Install it:

```bash
/plugin install turn-pixels --marketplace MattFenner/ClaudeGoodies
```

## Developing

See [plugins/todo/README.md](plugins/todo/README.md) for working on a plugin locally. In short:

```bash
claude --plugin-dir ./plugins/todo   # load it live; edits hot-reload
scripts/check.sh                     # validate, test and type-check every plugin
```
