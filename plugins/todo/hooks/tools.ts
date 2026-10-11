export const manifest = {
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
