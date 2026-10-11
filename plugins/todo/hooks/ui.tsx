import type { Elements } from "claude-code";

import type { Todo, TodoStore } from "../types";

export const PANE = "todo";

// Draws the Todos pane: the counts, open todos with an input to add in the next slot, then finished ones.
// Colors are theme names, so the pane follows the person's theme. Pure: it draws what it is given.
export async function renderPane(
  els: Elements[keyof Elements],
  store: TodoStore,
) {
  const { Box, Text, Button } = els;
  const list = await store.getAll();
  const openTodos = list.filter((t) => !t.isDone);
  const doneTodos = list.filter((t) => t.isDone);

  const row = (t: Todo) => (
    <Box
      key={`row-${t.id}`}
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
    >
      <Button
        key={`toggle-${t.id}`}
        plain
        onPress={() => void store.toggle(t.id)}
      >
        <Text color={t.isDone ? "success" : "suggestion"}>
          {t.isDone ? "☑" : "☐"}
        </Text>{" "}
      </Button>
      <Box flexGrow={1}>
        <Text
          color={t.isDone ? "subtle" : "text"}
          wrap="wrap"
          strikethrough={t.isDone}
        >
          {t.text}
        </Text>
      </Box>
      <Button
        key={`remove-${t.id}`}
        plain
        onPress={() => void store.remove(t.id)}
      >
        <Text color="subtle">✕</Text>
      </Button>
    </Box>
  );

  // The input sits where the next todo would be: a dim checkbox, then the field.
  const addRow = "Input" in els && (
    <Box key="add-row" flexDirection="row" alignItems="center" gap={1}>
      <Text color="subtle">☐</Text>
      <Box flexGrow={1}>
        <els.Input
          key="new"
          placeholder="Add a todo…"
          submitLabel="add"
          value=""
          onSubmit={(text) => {
            if (text.trim()) void store.add(text);
          }}
        />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
      <Box flexDirection="row" justifyContent="flex-end">
        <Text color="subtle">
          {openTodos.length} open · {doneTodos.length} done
        </Text>
      </Box>

      {list.length === 0 && (
        <Box flexDirection="column">
          <Text>Nothing to do ✨</Text>
          <Text color="subtle">Add one below or with /todo &lt;text&gt;.</Text>
        </Box>
      )}

      <Box flexDirection="column">
        {openTodos.map(row)}
        {addRow}
      </Box>

      {doneTodos.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="subtle">
            Done
          </Text>
          {doneTodos.map(row)}
        </Box>
      )}

      {doneTodos.length > 0 && (
        <Button
          key="clear-done"
          label="Clear done"
          onPress={() => void store.clearDone()}
        />
      )}
    </Box>
  );
}
