import type { Elements } from "claude-code";

import type { Todo, TodoStore } from "../types";

export const PANE = "todo";

// Blank lines between todos. Raise it for more air, or set 0 for a tight list.
const ROW_GAP = 1;
// Extra blank lines above the add field, on top of ROW_GAP, to set it apart from the todos.
const ADD_ROW_EXTRA_GAP = 1;

// Draws the Todos pane: the counts, open todos with an input to add in the next slot, then finished ones.
// Colors are theme names, so the pane follows the person's theme. Pure: it draws what it is given.
export async function renderPane(
  els: Elements[keyof Elements],
  store: TodoStore,
) {
  const { Box, Text, Button } = els;
  const list = await store.getAll();
  const expanded = await store.getExpanded();
  const editing = await store.getEditing();
  const addCount = await store.getAddCount();
  const openTodos = list.filter((t) => !t.isDone);
  const doneTodos = list.filter((t) => t.isDone);
  const canType = "Input" in els;

  // A todo: its checkbox, its title, a chevron and a remove button.
  // - Clicking the title edits it in place; Enter saves and cancel puts it back.
  // - The chevron expands the todo to show its notes underneath, as text styled like the title.
  //   Clicking the notes edits them the same way. The chevron is brighter when the todo has notes.
  // Where there is no text field (it needs one to edit), clicking the title expands the notes instead.
  const row = (t: Todo) => {
    const isOpen = expanded.includes(t.id);
    const isEditing = canType && editing === `title:${t.id}`;
    const isEditingNotes = canType && editing === `notes:${t.id}`;
    const textColor = t.isDone ? "subtle" : "text";

    return (
      <Box key={`row-${t.id}`} flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button
            key={`toggle-${t.id}`}
            plain
            onPress={() => void store.toggle(t.id)}
          >
            <Text color={t.isDone ? "success" : "suggestion"}>
              {t.isDone ? "☑" : "☐"}
            </Text>
          </Button>
          <Box flexGrow={1}>
            {isEditing ? (
              <Box flexDirection="row" alignItems="center" gap={1}>
                <els.Input
                  key={`edit-${t.id}`}
                  autoFocus
                  placeholder="Todo"
                  submitLabel="✅"
                  value={t.text}
                  onSubmit={(text) => void store.setText(t.id, text)}
                />
                <Button
                  key={`cancel-${t.id}`}
                  plain
                  onPress={() => void store.setEditing("")}
                >
                  <Text>❌</Text>
                </Button>
              </Box>
            ) : (
              <Button
                key={`title-${t.id}`}
                plain
                onPress={() =>
                  void (canType
                    ? store.setEditing(`title:${t.id}`)
                    : store.toggleExpanded(t.id))
                }
              >
                <Text
                  color={textColor}
                  dimColor={t.isDone}
                  wrap="wrap"
                  strikethrough={t.isDone}
                >
                  {t.text}
                </Text>
              </Button>
            )}
          </Box>
          <Button
            key={`expand-${t.id}`}
            plain
            onPress={() => void store.toggleExpanded(t.id)}
          >
            <Text
              color={t.notes ? "suggestion" : "subtle"}
              dimColor={!t.notes}
            >
              {isOpen ? "▾" : "▸"}
            </Text>
          </Button>
          <Button
            key={`remove-${t.id}`}
            plain
            onPress={() => void store.remove(t.id)}
          >
            <Text color="subtle" dimColor>
              ✕
            </Text>
          </Button>
        </Box>

        {isOpen && (
          <Box
            key={`notes-box-${t.id}`}
            flexDirection="row"
            gap={1}
            paddingLeft={3}
            paddingBottom={1}
          >
            <Box flexGrow={1}>
              {isEditingNotes ? (
                <Box flexDirection="row" alignItems="center" gap={1}>
                  <els.Input
                    key={`notes-${t.id}`}
                    autoFocus
                    placeholder="Add notes…"
                    submitLabel="✅"
                    value={t.notes ?? ""}
                    onSubmit={(text) => void store.setNotes(t.id, text)}
                  />
                  <Button
                    key={`cancel-notes-${t.id}`}
                    plain
                    onPress={() => void store.setEditing("")}
                  >
                    <Text>❌</Text>
                  </Button>
                </Box>
              ) : (
                <Button
                  key={`notes-text-${t.id}`}
                  plain
                  onPress={() =>
                    void (canType && store.setEditing(`notes:${t.id}`))
                  }
                >
                  {t.notes ? (
                    <Text
                      color={textColor}
                      dimColor={t.isDone}
                      wrap="wrap"
                      strikethrough={t.isDone}
                    >
                      {t.notes}
                    </Text>
                  ) : (
                    <Text color="subtle" dimColor wrap="wrap">
                      {canType ? "Add notes…" : "No notes."}
                    </Text>
                  )}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // The input sits where the next todo would be: a dim checkbox, then the field.
  // A field only resets when it is drawn with a different value, and this one is always drawn empty,
  // so its key changes with each add: that draws a fresh, empty field and clears what was typed.
  const addRow = canType && (
    <Box
      key="add-row"
      flexDirection="row"
      alignItems="center"
      gap={1}
      marginTop={openTodos.length > 0 ? ADD_ROW_EXTRA_GAP : 0}
    >
      <Text color="subtle">+</Text>
      <Box flexGrow={1}>
        <els.Input
          key={`new-${addCount}`}
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

      <Box flexDirection="column" gap={ROW_GAP}>
        {openTodos.map(row)}
        {addRow}
      </Box>

      {doneTodos.length > 0 && (
        <Box flexDirection="column" gap={ROW_GAP}>
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
