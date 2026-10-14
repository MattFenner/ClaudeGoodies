import { atom, read, update, type Color } from "claude-code";

import type {
  EngineInterface,
  Register,
  RenderElement,
  RenderInput,
  RenderInputOf,
  UiLogOptions,
} from "claude-code";
import { spanRows } from "./details";
import { normalizeEvent } from "./events";
import { gridOf, gridToTerminal } from "./grid";
import { makeSpans, sinceLastPrompt } from "./spans";
import { callInfo, callOutcome, keepNewest, summarizePrompt } from "./tools";
import { LOG_DIR, staleLogs, toJsonl } from "./log";
import type { Logger } from "./log";
import type { ToolCallInfo } from "../types";

// Every telemetry entry the collector has seen this session, oldest first.
const eventsAtom = atom({ plugin: "pixels", key: "events" } as const, []);

// What the tool.call hook learned about each call, keyed by tool_use_id. Joined
// onto the tool spans when they are built. Kept in memory only, never logged,
// since tool arguments can hold paths and commands.
const toolCallsAtom = atom(
  { plugin: "pixels", key: "toolCalls" } as const,
  {} as Record<string, ToolCallInfo>,
);
const MAX_TOOL_CALLS = 500;

// The prompts the prompt.submit hook saw, with when. Telemetry redacts the text.
// In memory only, like the tool calls.
const promptsAtom = atom({ plugin: "pixels", key: "prompts" } as const, []);
const MAX_PROMPTS = 50;

// $.fs has no append, so the session's file is rewritten from the events atom.
// Writes are chained so a slow one can't land after a newer one.
let logQueue: Promise<void> = Promise.resolve();
let hasPruned = false;
function writeLog($: EngineInterface): void {
  logQueue = logQueue
    .then(async () => {
      const dir = `${$.plugin.root}/${LOG_DIR}`;
      const pathPrefix = `${dir}/${await $.session.id()}`;
      await $.fs.write(pathPrefix+ ".events.jsonl", toJsonl(await read($, eventsAtom)));
      await $.fs.write(pathPrefix+ ".prompts.jsonl", toJsonl(await read($, promptsAtom)));
      await $.fs.write(pathPrefix+ ".tools.jsonl", toJsonl(await read($, toolCallsAtom)));
      if (!hasPruned) {
        hasPruned = true;
        await pruneLogs($, dir, pathPrefix+ ".events.jsonl");
        await pruneLogs($, dir, pathPrefix+ ".prompts.jsonl");
      }
    })
    .catch((err) => $.ui.log(`events log write failed: ${err}`));
}

// $.fs can't delete, so old logs go through the host's own delete command.
async function pruneLogs(
  $: EngineInterface,
  dir: string,
  keep: string,
): Promise<void> {
  for (const path of staleLogs(await $.fs.list(dir), dir, keep, Date.now())) {
    const removed = await $.process
      .run(["rm", "-f", path])
      .catch(() => undefined);
    if (removed?.exitCode !== 0) {
      await $.process
        .run(["cmd", "/c", "del", "/f", "/q", path.replaceAll("/", "\\")])
        .catch((err) => $.ui.log(`could not delete old log ${path}: ${err}`));
    }
  }
}

const PANE = "pixels";

export const register: Register = (on) => {
  // The pane is optional: nothing opens it until the person runs /pixels.
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "pixels",
      description: "Show or hide the pane listing this session's spans",
    });
    return next(e);
  });

  on("command.run", { command: "pixels" }, async ($) => {
    if ((await $.ui.panes()).some((pane) => pane.id === PANE)) {
      await $.ui.close({ id: PANE });
      return { text: "Pixels pane closed." };
    }
    const { isPlaced } = await $.ui.open({ id: PANE, title: "Pixels" });
    return {
      text: isPlaced
        ? "pane opened."
        : "pane opened, but the terminal is too narrow to show it yet.",
    };
  });

  // Watches every prompt and always passes it on unchanged.
  on("prompt.submit", async ($, e, next) => {
    $.ui.log(JSON.stringify(e));
    await update($, promptsAtom, (d) =>
      [...d, { at: Date.now(), text: summarizePrompt(e.text) }].slice(
        -MAX_PROMPTS,
      ),
    );
    return next(e);
  });

  // Watches every tool call and always passes it on unchanged.
  on("tool.call", async ($, e, next) => {
    const id = e.tool_use_id;
    if (id) {
      await update($, toolCallsAtom, (d) =>
        keepNewest(
          { ...d, [id]: callInfo(e) } as Record<string, ToolCallInfo>,
          MAX_TOOL_CALLS,
        ),
      );
    }
    const answer = await next(e);
    if (id) {
      await update(
        $,
        toolCallsAtom,
        (d) =>
          ({
            ...d,
            [id]: {
              ...(d[id] ?? ({ tool: "unknown" } as ToolCallInfo)),
              ...callOutcome(answer),
            },
          }) as Record<string, ToolCallInfo>,
      );
    }
    return answer;
  });

  on("telemetry.log", { to: "collector" }, async ($, e, next) => {
    await update($, eventsAtom, (d) => [...d, normalizeEvent(e)]);
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.surface === "terminal") {
      return renderBarTerminal($, e);
    }
    
    // FIXME: render for desktop

    writeLog($);
    return next(e);
  });

  on(
    "ui.render",
    { component: "Pane", requestId: PANE },
    async ($, e, _next) => {
      return await renderPane($, e);
    },
  );
};

async function renderPane($: EngineInterface, e: RenderInput) : Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e);
  const events = await read($, eventsAtom);
  const toolCalls = await read($, toolCallsAtom);
  const prompts = await read($, promptsAtom);
  const spans = sinceLastPrompt(
    makeSpans({events, toolCalls, prompts}, makeLogger($)),
  );
  // Everything since the last prompt: the pane scrolls its own body.
  const rows = spanRows(spans);

  function colorOf(c: number): Color {
    return `#${c.toString(16).padStart(6, "0")}`
  }

  return (
    <Box flexDirection="column">
      {rows.length === 0 && <Text dimColor>No data yet.</Text>}
      {rows.map((row) => (
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Text
              backgroundColor={colorOf(row.style.color)}
            >
              {" "}
            </Text>
            <Text
              wrap="truncate"
              color={row.status === "failed" ? "error" : undefined}
              dimColor={row.status === "" && row.duration === ""}
            >
              {` ${row.label}  ${row.duration}  ${row.status !== 'ok' ? row.status : ''}`.trimEnd()}
            </Text>
          </Box>
          {row.details.map((line) => (
            <Text wrap="truncate" dimColor>
              {`    ${line}`}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

async function renderBarTerminal(
  $: EngineInterface,
  e: RenderInputOf<"AbovePrompt", "terminal">,
) : Promise<RenderElement> {
  const events = await read($, eventsAtom);
  const toolCalls = await read($, toolCallsAtom);
  const prompts = await read($, promptsAtom);

  const { Box, Raster } = $.ui.resolve(e);

  // leave a gap on the right for the close button
  const columns = (e.viewport?.columns ?? 100) - 5;
  const rows = 1;

  const cells = gridOf(makeSpans({events, toolCalls, prompts}, makeLogger($)), columns);

  // $.ui.log(debugView(cells));
  // $.ui.log(JSON.stringify(e.viewport));

  // One Text per line, its runs nested inside, cut rather than wrapped.
  return Box({
    flexDirection: "column",
    children: [
      Raster({
        key: "test",
        columns: columns,
        rows: rows,
        cells: gridToTerminal(cells),
      }),
      // Text({ children: [`Last event: ${events[events.length - 1]?.type}`] }),
    ],
  });
}

function makeLogger($: EngineInterface): Logger {
  return {
    logDebug(text: string, options?: UiLogOptions) : void {
      $.ui.log(text, options);
    },
  };
}
