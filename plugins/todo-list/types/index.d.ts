export type Todo = { id: string; text: string; isDone: boolean; createdAt: string }

declare module 'claude-code' {
  interface PluginState {
    'todo-list': { todos: Todo[] }
  }
}
