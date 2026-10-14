import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiOpenResult } from 'claude-code'

import type { Todo, TodoStore } from '../types'
import * as ui from './ui'
import * as tools from './tools'

const TOOL = 'mcp__todo__todos'
const todos = atom({ plugin: 'todo', key: 'list' } as const, [])

const openPane = ($: EngineInterface): Promise<UiOpenResult> => $.ui.open({ id: ui.PANE, title: 'Todos' })

function newTodo(text: string): Todo {
  return {
    id: crypto.randomUUID().slice(0, 8),
    text: text.trim(),
    isDone: false,
    createdAt: new Date().toISOString(),
  }
}

// Abstracts the store of todos, so the other code doesn't have to know about atoms or the persistent store.
function storeOf($: EngineInterface) : TodoStore {
  // Every change goes through here: session state redraws the pane, the store keeps it across sessions.
  const change = async (fn: (list: Todo[]) => Todo[]): Promise<void> => {
    await update($, todos, list => fn(list ?? []))
    await $.store.set('todos', await read($, todos))
  }

  return {
    async load() {
      const saved = ((await $.store.get('todos')) as Todo[] | undefined) ?? []
      await update($, todos, () => saved)
    },
    getAll: () => read($, todos),
    async getById(id?: string) {
      return id ? (await read($, todos)).find(t => t.id === id) : undefined
    },
    add: (text: string) => change(list => [...list, newTodo(text)]),
    toggle: (id: string) => change(list => list.map(t => (t.id === id ? { ...t, isDone: !t.isDone } : t))),
    remove: (id: string) => change(list => list.filter(t => t.id !== id)),
    clearDone: () => change(list => list.filter(t => !t.isDone)),
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await storeOf($).load()

    await $.command.register({
      name: 'todo',
      description: 'Work with your todo list. Opens the Todos panel if no text is given.',
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
    await storeOf($).add(text)
    return { text: `Added todo: ${text}` }
  })

  on('tool.call', { tool: TOOL }, ($, e) =>
    tools.runTool(storeOf($), e as unknown as tools.ToolInput).catch((err: unknown) => ({
      result: `todo failed: ${String(err)}`,
      isError: true,
    })),
  )

  on('ui.render', { component: 'Pane', requestId: ui.PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const store = storeOf($)

    return ui.renderPane(els, store)
  })
}
