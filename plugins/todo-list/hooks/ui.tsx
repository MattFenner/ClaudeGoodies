import type { Elements } from 'claude-code'

import type { Todo } from '../types'

export const PANE = 'todo-list'

// What the pane's controls do; the registration file supplies them, bound to the engine.
export type TodoActions = {
  add: (text: string) => void
  toggle: (id: string) => void
  remove: (id: string) => void
  clearDone: () => void
}

// Draws the Todos pane: a count, an input to add, and a row per todo. Pure: it draws the list and actions it is given.
export function renderPane(els: Elements[keyof Elements], list: Todo[], act: TodoActions) {
  const { Box, Text, Button } = els
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
            if (text.trim()) act.add(text)
          }}
        />
      )}
      {list.length === 0 && <Text dimColor>Nothing to do. Add one above or with /todo &lt;text&gt;.</Text>}
      {list.map(t => (
        <Box key={`row-${t.id}`} flexDirection="row">
          <Button key={`toggle-${t.id}`} plain onPress={() => act.toggle(t.id)}>
            {t.isDone ? '☑ ' : '☐ '}
            <Text dimColor={t.isDone} strikethrough={t.isDone}>
              {t.text}
            </Text>
          </Button>
          <Text> </Text>
          <Button key={`remove-${t.id}`} plain label="✕" onPress={() => act.remove(t.id)} />
        </Box>
      ))}
      {list.some(t => t.isDone) && <Button key="clear-done" label="Clear done" onPress={() => act.clearDone()} />}
    </Box>
  )
}
