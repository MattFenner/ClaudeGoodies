import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Todo, TodoStore } from '../types'
import * as ui from './ui'
import * as tools from './tools'

const TOOL = 'mcp__todo__todos'
const todos = atom({ plugin: 'todo', key: 'list' } as const, [])
// Which todos are shown expanded. Session state only: it is not saved.
const expanded = atom({ plugin: 'todo', key: 'expanded' } as const, [])
// What is being edited: 'title:<id>' or 'notes:<id>', or '' for nothing. Session state only.
const editing = atom({ plugin: 'todo', key: 'editing' } as const, '')
// How many todos were added this session. The pane keys its add field by this.
const added = atom({ plugin: 'todo', key: 'added' } as const, 0)

const openPane = ($: EngineInterface) => $.ui.open({ id: ui.PANE, title: 'Todos' })

function newTodo(text: string, notes?: string): Todo {
  return {
    id: crypto.randomUUID().slice(0, 8),
    text: text.trim(),
    ...(notes?.trim() ? { notes: notes.trim() } : {}),
    isDone: false,
    createdAt: new Date().toISOString(),
  }
}

// The todo with its notes set, or with none when they are empty.
function withNotes(todo: Todo, notes: string): Todo {
  const { notes: _previous, ...rest } = todo
  return notes.trim() ? { ...rest, notes: notes.trim() } : rest
}

// Abstracts the store of todos, so the other code doesn't have to know about atoms or the persistent store.
function storeOf($: EngineInterface) : TodoStore {
  // Every change goes through here: session state redraws the pane, the store keeps it across sessions.
  // A failure is shown in a toast: the pane's handlers don't wait for the result, so it would go unseen.
  const change = async (fn: (list: Todo[]) => Todo[]) => {
    try {
      await update($, todos, list => fn(list ?? []))
      await $.store.set('todos', await read($, todos))
    } catch (err) {
      $.ui.toast(`todo: could not save: ${String(err)}`)
    }
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
    async getExpanded() {
      return (await read($, expanded)) ?? []
    },
    toggleExpanded: (id: string) =>
      update($, expanded, ids => {
        const current = ids ?? []
        return current.includes(id) ? current.filter(x => x !== id) : [...current, id]
      }),
    async getEditing() {
      return (await read($, editing)) ?? ''
    },
    setEditing: (target: string) => update($, editing, () => target),
    async setText(id: string, text: string) {
      if (text.trim()) await change(list => list.map(t => (t.id === id ? { ...t, text: text.trim() } : t)))
      await update($, editing, () => '')
    },
    async getAddCount() {
      return (await read($, added)) ?? 0
    },
    async add(text: string, notes?: string) {
      await change(list => [...list, newTodo(text, notes)])
      await update($, added, n => (n ?? 0) + 1)
    },
    async setNotes(id: string, notes: string) {
      await change(list => list.map(t => (t.id === id ? withNotes(t, notes) : t)))
      await update($, editing, () => '')
    },
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
