import type { Todo } from '../types'

export function newTodo(text: string): Todo {
  return {
    id: crypto.randomUUID().slice(0, 8),
    text: text.trim(),
    isDone: false,
    createdAt: new Date().toISOString(),
  }
}

export function describe(list: Todo[]): string {
  if (list.length === 0) return 'The todo list is empty.'
  return list.map(t => `[${t.isDone ? 'x' : ' '}] ${t.id}  ${t.text}`).join('\n')
}
