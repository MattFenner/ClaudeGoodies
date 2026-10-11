import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Todo } from '../types'

const PANE = 'todo-list'
const FILE = 'todos.json'
const TOOL = 'mcp__todo-list__todos'
const todos = atom({ plugin: 'todo-list', key: 'todos' } as const, [])

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Todos' })

// The plugin data folder survives plugin updates; the engine names it in CLAUDE_PLUGIN_DATA.
async function dataFile($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  const dir = (await $.env.get('CLAUDE_PLUGIN_DATA')) ?? `${home}/.claude/plugins/data/todo-list`
  return `${dir}/${FILE}`
}

async function load($: EngineInterface): Promise<Todo[]> {
  try {
    return JSON.parse(await $.fs.read(await dataFile($))).todos as Todo[]
  } catch {
    // First run since the move: take over the list kept in the old store.
    const saved = await $.store.get('todos')
    return Array.isArray(saved) ? (saved as Todo[]) : []
  }
}

// Every change goes through here: session state redraws the pane, the data file keeps it across sessions.
async function change($: EngineInterface, fn: (list: Todo[]) => Todo[]) {
  await update($, todos, list => fn(list ?? []))
  const list = await read($, todos)
  await $.fs.write(await dataFile($), JSON.stringify({ todos: list }, null, 2))
}

function newTodo(text: string): Todo {
  return {
    id: crypto.randomUUID().slice(0, 8),
    text: text.trim(),
    isDone: false,
    createdAt: new Date().toISOString(),
  }
}

const addTodo = ($: EngineInterface, text: string) => change($, list => [...list, newTodo(text)])
const toggleTodo = ($: EngineInterface, id: string) =>
  change($, list => list.map(t => (t.id === id ? { ...t, isDone: !t.isDone } : t)))
const removeTodo = ($: EngineInterface, id: string) => change($, list => list.filter(t => t.id !== id))
const clearDone = ($: EngineInterface) => change($, list => list.filter(t => !t.isDone))

type ToolInput = { action?: string; text?: string; id?: string }

function describe(list: Todo[]): string {
  if (list.length === 0) return 'The todo list is empty.'
  return list.map(t => `[${t.isDone ? 'x' : ' '}] ${t.id}  ${t.text}`).join('\n')
}

async function runTool($: EngineInterface, input: ToolInput) {
  const list = await read($, todos)
  const found = input.id ? list.find(t => t.id === input.id) : undefined

  switch (input.action) {
    case 'list':
      return { result: describe(list) }
    case 'add':
      if (!input.text?.trim()) return { result: 'add needs a non-empty text.', isError: true as const }
      await addTodo($, input.text)
      break
    case 'complete':
    case 'reopen':
    case 'remove':
      if (!found) return { result: `No todo with id "${input.id ?? ''}".`, isError: true as const }
      if (input.action === 'remove') await removeTodo($, found.id)
      else if (found.isDone !== (input.action === 'complete')) await toggleTodo($, found.id)
      break
    case 'clear_done':
      await clearDone($)
      break
    default:
      return { result: `Unknown action "${input.action ?? ''}".`, isError: true as const }
  }

  return { result: `Done. Current list:\n${describe(await read($, todos))}` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await load($)
    await update($, todos, () => saved)

    await $.command.register({
      name: 'todo',
      description: 'Open the todo panel, or add a todo: /todo <text>',
      argumentHint: '[text]',
    })
    await $.tool.register({
      name: 'todos',
      description:
        "Read and manage the user's persistent todo list (shown in the Todos panel). " +
        "action 'list' returns every todo with its id; 'add' needs text; " +
        "'complete', 'reopen' and 'remove' need id; 'clear_done' removes finished ones.",
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'complete', 'reopen', 'remove', 'clear_done'] },
          text: { type: 'string' },
          id: { type: 'string' },
        },
        required: ['action'],
      },
      isDeferred: false,
    })
    void openPane($)

    return next(e)
  })

  on('command.run', { command: 'todo' }, async ($, e) => {
    const text = e.args.trim()
    await openPane($)
    if (!text) return { text: 'Todo panel opened.' }
    await addTodo($, text)
    return { text: `Added todo: ${text}` }
  })

  on('tool.call', { tool: TOOL }, ($, e) =>
    runTool($, e as unknown as ToolInput).catch((err: unknown) => ({
      result: `todo-list failed: ${String(err)}`,
      isError: true,
    })),
  )

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const list = await read($, todos)
    const open = list.filter(t => !t.isDone).length

    return (
      <Box flexDirection="column">
        <Text bold>
          {open} open · {list.length - open} done
        </Text>
        {'Input' in els && (
          <els.Input
            key="new"
            placeholder="Add a todo…"
            submitLabel="add"
            value=""
            onSubmit={text => {
              if (text.trim()) void addTodo($, text)
            }}
          />
        )}
        {list.length === 0 && <Text dimColor>Nothing to do. Add one above or with /todo &lt;text&gt;.</Text>}
        {list.map(t => (
          <Box key={`row-${t.id}`} flexDirection="row">
            <Button key={`toggle-${t.id}`} plain onPress={() => void toggleTodo($, t.id)}>
              {t.isDone ? '☑ ' : '☐ '}
              <Text dimColor={t.isDone} strikethrough={t.isDone}>
                {t.text}
              </Text>
            </Button>
            <Text> </Text>
            <Button key={`remove-${t.id}`} plain label="✕" onPress={() => void removeTodo($, t.id)} />
          </Box>
        ))}
        {list.some(t => t.isDone) && (
          <Button key="clear-done" label="Clear done" onPress={() => void clearDone($)} />
        )}
      </Box>
    )
  })
}
