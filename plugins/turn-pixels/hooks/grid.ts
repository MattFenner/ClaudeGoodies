import type { Span } from "./spans";

export type Row = Cell[];
export type Grid = Row[];

// A Raster color of this value means "the terminal's own default".
export const COLOR_NONE = 0x01000000;

export type Cell = {
  char: string | undefined;
  color: number | undefined;
  background: number | undefined;
};

const BLACK = 0x000000;
const WHITE = 0xffffff;

type CellStyle = { color: number; background: number };

// Events whose whole type gets a fixed look. Checked before the prefix rules.
const EXACT_STYLES: Record<string, Cell> = {
  user_prompt: { char: " ", color: BLACK, background: COLOR_NONE },
};

// First match wins. The cell shows the first letter of the type after the prefix.
const PREFIX_STYLES: [prefix: string, style: CellStyle][] = [
  ["tool_", { color: BLACK, background: 0xaaaaff }], // blue
  ["user_", { color: BLACK, background: 0xffffff }], // white
  ["mcp_", { color: BLACK, background: 0xaaffaa }], // green
  ["assistant_", { color: WHITE, background: 0x111111 }], // dark grey
];

// Anything that matches no rule: its own first letter, lowercased.
const FALLBACK_STYLE: CellStyle = { color: BLACK, background: 0xffaaff }; // magenta

const EMPTY_CELL: Cell = {
  char: " ",
  color: COLOR_NONE,
  background: COLOR_NONE,
};

export function spanToCell(span: Pick<Span, "type">): Cell {
  const exact = EXACT_STYLES[span.type];
  if (exact) return exact;

  for (const [prefix, style] of PREFIX_STYLES) {
    if (span.type.startsWith(prefix)) {
      return {
        char: span.type.slice(prefix.length)[0]?.toUpperCase() || "?",
        ...style,
      };
    }
  }

  return { char: span.type?.[0]?.toLowerCase() || " ", ...FALLBACK_STYLE };
}

const MS_PER_CELL = 1000;

// How many cells a span takes up: one per second, never fewer than one. A span
// that is still open has no duration yet, so it takes one.
export function cellsFor(span: Pick<Span, "durationMs">): number {
  return Math.max(1, Math.round((span.durationMs ?? 0) / MS_PER_CELL));
}

export function gridOf(spans: Span[], columns: number): Grid {
  const row: Row = [];
  let previous: Cell | undefined;
  for (const span of spans) {
    const cell = spanToCell(span);
    // A span that looks like the one before it shows a space in place of its
    // letter, so a run of the same kind reads as one block.
    const isRepeat = previous?.background === cell.background && previous?.char === cell.char;
    previous = cell;
    for (let i = 0; i < cellsFor(span); i++) {
      row.push(i === 0 && !isRepeat ? cell : { ...cell, char: " " });
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
    .flatMap(({ char, color, background }) => [
      (char ?? " ").codePointAt(0),
      color ?? COLOR_NONE,
      background ?? COLOR_NONE,
    ]);
  return new Uint8Array(Uint32Array.from(numbers).buffer).toBase64();
}

// A Raster color: 0x00RRGGBB, each channel rounded and clamped to 0-255.
export function rgbToHex(r: number, g: number, b: number): number {
  const channel = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (channel(r) << 16) | (channel(g) << 8) | channel(b);
}
