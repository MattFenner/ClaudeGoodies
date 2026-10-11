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

## Developing

See [plugins/todo/README.md](plugins/todo/README.md) for working on a plugin locally. In short:

```bash
claude --plugin-dir ./plugins/todo   # load it live; edits hot-reload
scripts/check.sh                     # validate, test and type-check every plugin
```
