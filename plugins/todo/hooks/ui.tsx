import type { Elements } from 'claude-code'

import type { Todo, TodoStore } from '../types'

export const PANE = 'todo'

// Draws the Todos pane: a count, an input to add, and a row per todo. Pure: it draws the list and actions it is given.
export async function renderPane(els: Elements[keyof Elements], store: TodoStore) {
  const { Box, Text, Button } = els
  const list = await store.getAll()
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
            if (text.trim()) void store.add(text)
          }}
        />
      )}
      {list.length === 0 && <Text dimColor>Nothing to do. Add one above or with /todo &lt;text&gt;.</Text>}
      {list.map(t => (
        <Box key={`row-${t.id}`} flexDirection="row">
          <Button key={`toggle-${t.id}`} plain onPress={() => void store.toggle(t.id)}>
            {t.isDone ? '☑ ' : '☐ '}
            <Text dimColor={t.isDone} strikethrough={t.isDone}>
              {t.text}
            </Text>
          </Button>
          <Text> </Text>
          <Button key={`remove-${t.id}`} plain label="✕" onPress={() => void store.remove(t.id)} />
        </Box>
      ))}
      {list.some(t => t.isDone) && <Button key="clear-done" label="Clear done" onPress={() => void store.clearDone()} />}
    </Box>
  )
}
