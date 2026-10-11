import type { On } from 'claude-code'

export type StoredTodo = { id: string; text: string; isDone: boolean; createdAt: string }

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
