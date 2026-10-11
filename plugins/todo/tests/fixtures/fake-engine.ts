import type { On } from 'claude-code'

import type { Todo } from '../../types'

export type StoredTodo = Todo

// Stands in for the engine beneath the plugin: an in-memory store, and the registrations
// the plugin makes when a session starts. Returns what the plugin saved and which panes it opened.
export function fakeEngine(on: On, initial?: StoredTodo[]) {
  let stored = initial
  const opened: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: stored }))
  on('store.set', ($, e) => {
    stored = e.value as StoredTodo[]
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', () => ({ value: { tool: 'mcp__todo__todos' } }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })

  return { stored: () => stored, opened }
}

export const todo = (id: string, text: string, isDone = false): StoredTodo => ({
  id,
  text,
  isDone,
  createdAt: '2026-01-01T00:00:00.000Z',
})

// The part of a mounted pane the helpers below use.
type Pane = {
  findAll: (query: { type?: string }) => Promise<{ key?: string }[]>
  input: (target: { key: string; text: string }) => Promise<unknown>
}

// The key of the pane's add field. It changes with each add (see ui.tsx), so it is found by its prefix.
export async function addFieldKey(ui: Pane): Promise<string> {
  const field = (await ui.findAll({ type: 'Input' })).find(i => i.key?.startsWith('new-'))
  if (!field?.key) throw new Error('the pane has no add field')
  return field.key
}

// Types a todo into the pane's add field and submits it.
export async function addTodo(ui: Pane, text: string) {
  await ui.input({ key: await addFieldKey(ui), text })
}
