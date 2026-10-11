import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Todo } from '../types'
import { describe, newTodo } from './list'
import * as ui from './ui'
import * as tools from './tools'

const TOOL = 'mcp__todo__todos'
const todos = atom({ plugin: 'todo', key: 'todos' } as const, [])

type ToolInput = { action?: string; text?: string; id?: string }

const openPane = ($: EngineInterface) => $.ui.open({ id: ui.PANE, title: 'Todos' })

async function load($: EngineInterface): Promise<Todo[]> {
  return ((await $.store.get('todos')) as Todo[] | undefined) ?? []
}

// Every change goes through here: session state redraws the pane, the store keeps it across sessions.
async function change($: EngineInterface, fn: (list: Todo[]) => Todo[]) {
  await update($, todos, list => fn(list ?? []))
  await $.store.set('todos', await read($, todos))
}

const addTodo = ($: EngineInterface, text: string) => change($, list => [...list, newTodo(text)])
const toggleTodo = ($: EngineInterface, id: string) =>
  change($, list => list.map(t => (t.id === id ? { ...t, isDone: !t.isDone } : t)))
const removeTodo = ($: EngineInterface, id: string) => change($, list => list.filter(t => t.id !== id))
const clearDone = ($: EngineInterface) => change($, list => list.filter(t => !t.isDone))

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
  on('session.start', async ($ : EngineInterface, e, next) => {
    const saved = await load($)
    await update($, todos, () => saved)

    await $.command.register({
      name: 'todo',
      description: 'Open the todo panel, or add a todo: /todo <text>',
      argumentHint: '[text]',
    })
    await $.tool.register(tools.manifest)
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
      result: `todo failed: ${String(err)}`,
      isError: true,
    })),
  )

  on('ui.render', { component: 'Pane', requestId: ui.PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const list = await read($, todos)
    const act = {
      add: (text: string) => void addTodo($, text),
      toggle: (id: string) => void toggleTodo($, id),
      remove: (id: string) => void removeTodo($, id),
      clearDone: () => void clearDone($),
    }

    return ui.renderPane(els, list, act)
  })
}
