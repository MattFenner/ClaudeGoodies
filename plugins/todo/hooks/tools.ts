import type { RegisteredToolSpec } from "claude-code";

import type { Todo, TodoStore } from "../types";

export type ToolInput = { action?: string; text?: string; id?: string };

export type ToolResult =
  | { result: string; isError?: undefined }
  | { result: string; isError: true };

export const manifest: RegisteredToolSpec = {
  name: "todos",
  description:
    "Read and manage the user's persistent todo list (shown in the Todos panel). " +
    "action 'list' returns every todo with its id; 'add' needs text; " +
    "'complete', 'reopen' and 'remove' need id; 'clear_done' removes finished ones.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "add", "complete", "reopen", "remove", "clear_done"],
      },
      text: { type: "string" },
      id: { type: "string" },
    },
    required: ["action"],
  },
  isDeferred: false,
};

export async function runTool(
  store: TodoStore,
  input: ToolInput,
): Promise<ToolResult> {
  switch (input.action) {
    case "list":
      return { result: describe(await store.getAll()) };
    case "add":
      if (!input.text?.trim())
        return {
          result: "add needs a non-empty text.",
          isError: true as const,
        };
      await store.add(input.text);
      break;
    case "complete":
    case "reopen":
    case "remove": {
      const found = await store.getById(input.id);
      if (!found)
        return {
          result: `No todo with id "${input.id ?? ""}".`,
          isError: true as const,
        };
      if (input.action === "remove") await store.remove(found.id);
      else if (found.isDone !== (input.action === "complete"))
        await store.toggle(found.id);
      break;
    }
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
    .map((t) => `[${t.isDone ? "x" : " "}] ${t.id}  ${t.text}`)
    .join("\n");
}
