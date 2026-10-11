import type { Todo, TodoStore } from "../types";

export type ToolInput = {
  action?: string;
  text?: string;
  notes?: string;
  id?: string;
};

export const manifest = {
  name: "todos",
  description:
    "Read and manage the user's persistent todo list (shown in the Todos panel). " +
    "A todo has a title (text) and optional notes. " +
    "action 'list' returns every todo with its id and notes; 'add' needs text and may take notes; " +
    "'complete', 'reopen' and 'remove' need id; " +
    "'set_notes' needs id and notes (empty clears them); " +
    "'clear_done' removes finished ones.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "list",
          "add",
          "complete",
          "reopen",
          "remove",
          "set_notes",
          "clear_done",
        ],
      },
      text: { type: "string" },
      notes: { type: "string" },
      id: { type: "string" },
    },
    required: ["action"],
  },
  isDeferred: false,
};

export async function runTool(store: TodoStore, input: ToolInput) {
  switch (input.action) {
    case "list":
      return { result: describe(await store.getAll()) };
    case "add":
      if (!input.text?.trim())
        return {
          result: "add needs a non-empty text.",
          isError: true as const,
        };
      await store.add(input.text, input.notes);
      break;
    case "complete":
    case "reopen":
    case "remove":
    case "set_notes":
      const found = await store.getById(input.id);
      if (!found)
        return {
          result: `No todo with id "${input.id ?? ""}".`,
          isError: true as const,
        };
      if (input.action === "remove") await store.remove(found.id);
      else if (input.action === "set_notes")
        await store.setNotes(found.id, input.notes ?? "");
      else if (found.isDone !== (input.action === "complete"))
        await store.toggle(found.id);
      break;
    case "clear_done":
      await store.clearDone();
      break;
    default:
      return {
        result: `Unknown action "${input.action ?? ""}".`,
        isError: true as const,
      };
  }

  return { result: `Done. Current list:\n${describe(await store.getAll())}` };
}

export function describe(list: Todo[]): string {
  if (list.length === 0) return "The todo list is empty.";
  return list
    .map(
      (t) =>
        `[${t.isDone ? "x" : " "}] ${t.id}  ${t.text}` +
        (t.notes ? `\n      ${t.notes.replace(/\n/g, "\n      ")}` : ""),
    )
    .join("\n");
}
