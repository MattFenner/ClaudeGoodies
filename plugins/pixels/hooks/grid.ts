import type { Span } from "./spans";

export type Row = Cell[];
export type Grid = Row[];

// A Raster color of this value means "the terminal's own default".
export const COLOR_NONE = 0x01000000;

export type Cell = CellStyle & {
  char: string | undefined;
};

const BLACK = 0x000000;
const WHITE = 0xffffff;

type CellStyle = { foreground: number; background: number };

// First match wins. The cell shows the first letter of the type after the prefix.
// const PREFIX_STYLES: [prefix: string, style: CellStyle][] = [
//   ["user_prompt", { foreground: BLACK, background: COLOR_NONE }],
//   ["tool_", { foreground: BLACK, background: 0xAAAAff }],
//   ["user_", { foreground: BLACK, background: 0xffffff }],
//   ["mcp_", { foreground: BLACK, background: 0xaaffaa }],
//   ["assistant_", { foreground: WHITE, background: 0x111111 }],
// ];

// Anything that matches no rule: its own first letter, lowercased.
const FALLBACK_STYLE: CellStyle = { foreground: BLACK, background: 0xffaaff };

const EMPTY_CELL: Cell = {
  char: ' ',
  foreground: COLOR_NONE,
  background: COLOR_NONE,
};

const STYLE_USER: CellStyle = {
  background: COLOR_NONE,
  foreground: BLACK,
};

const STYLE_TOOL: CellStyle = {
  background: 0xaaaaff,
  foreground: BLACK,
};

const STYLE_AGENT: CellStyle = {
  background: 0xaaaaff,
  foreground: BLACK,
};

const STYLE_MCP: CellStyle = {
  background: 0xaaffaa,
  foreground: BLACK,
};

const STYLE_OTHER: CellStyle = {
  background: 0xffaaff,
  foreground: BLACK,
};

export function spanToCellStyle(span: Span): CellStyle {
  const type = span.type;

  if (type.startsWith("user_prompt")) return STYLE_USER;
  if (type.startsWith("user_input")) return { foreground: BLACK, background: 0xffffff };
  if (type.startsWith("assistant_")) return { foreground: WHITE, background: 0x111111 };
  if (type.startsWith("tool_")) return STYLE_TOOL;
  if (type.startsWith("mcp_")) return STYLE_MCP;

  return STYLE_OTHER;
}

const MS_PER_CELL = 1000;

// How many cells a span takes up: one per second, never fewer than one. A span
// that is still open has no duration yet, so it takes one.
export function spanToCellCount(span: Pick<Span, "durationMs">): number {
  return Math.max(1, Math.round((span.durationMs ?? 0) / MS_PER_CELL));
}

export function gridOf(spans: Span[], columns: number): Grid {
  const row: Row = [];
  for (const span of spans) {
    const style = spanToCellStyle(span);
    const title = spanToTitle(span);
    for (let i = 0; i < spanToCellCount(span); i++) {
      const cell = { char: (i < title.length) ? title[i] : " ", ...style };
      row.push(cell);
    }
  }
  // Too long for the row: keep the most recent cells.
  const visible = row.length > columns ? row.slice(row.length - columns) : row;
  // fill the remaining cells in the row with empty cells
  while (visible.length < columns) {
    visible.push(EMPTY_CELL);
  }
  return [visible];
}

// Pack rows of [character, color] pairs into the one string a Raster takes
// One cell is three numbers: the character's code point, its color, and its background
export function gridToTerminal(grid: Grid): string {
  const numbers = grid
    .flat()
    .flatMap(({ char, foreground, background }) => [
      (char ?? " ").codePointAt(0),
      foreground ?? COLOR_NONE,
      background ?? COLOR_NONE,
    ]);
  return new Uint8Array(Uint32Array.from(numbers).buffer).toBase64();
}

// A Raster color: 0x00RRGGBB, each channel rounded and clamped to 0-255.
export function rgbToHex(r: number, g: number, b: number): number {
  const channel = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (channel(r) << 16) | (channel(g) << 8) | channel(b);
}
function spanToTitle(span: Span): string {
  if (!span.durationMs || span.durationMs < 4000) return " ";

  if (span.kind === "tool") {
    return span.call?.summary ?? " ";
  }

  return " ";
}
