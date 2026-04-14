import SparkMD5 from "spark-md5";
import type { SeededRandom } from "../random/rng.ts";

const APERTURE_MIN_ID = 10;
const APERTURE_MAX_ID = 8191;
const ADD_LINE_PATTERN = /^%ADD(\d{2,4})\D/;
const USED_APERTURE_PATTERN = /D(\d{2,4})\*/g;
const NUMBER_PATTERN = /,([\d.]+)/;

interface TextLayout {
  eol: "\n" | "\r\n";
  hasTrailingNewline: boolean;
}

interface AddLine {
  id: number;
  line: string;
  lineIndex: number;
}

function splitText(content: string): { layout: TextLayout; lines: string[] } {
  return {
    layout: {
      eol: content.includes("\r\n") ? "\r\n" : "\n",
      hasTrailingNewline: content.endsWith("\n"),
    },
    lines: content.split(/\r\n|\n/),
  };
}

function joinText(lines: string[], layout: TextLayout): string {
  const nextText = lines.join(layout.eol);
  return layout.hasTrailingNewline && nextText.length > 0
    ? `${nextText}${layout.eol}`
    : nextText;
}

function collectAddLines(lines: string[]): AddLine[] {
  return lines.flatMap((line, lineIndex) => {
    const matched = line.match(ADD_LINE_PATTERN);
    if (!matched) {
      return [];
    }

    return [
      {
        id: Number(matched[1]),
        line,
        lineIndex,
      },
    ];
  });
}

function collectUsedApertures(lines: string[]): Set<number> {
  const used = new Set<number>();

  for (const line of lines) {
    for (const matched of line.matchAll(USED_APERTURE_PATTERN)) {
      const apertureId = Number(matched[1]);
      if (apertureId >= APERTURE_MIN_ID) {
        used.add(apertureId);
      }
    }
  }

  return used;
}

function stripUnusedAddLines(lines: string[]): string[] {
  const addLines = collectAddLines(lines);
  if (addLines.length === 0) {
    return [...lines];
  }

  const usedApertures = collectUsedApertures(lines);
  const removedIndexes = new Set(
    addLines
      .filter((entry) => !usedApertures.has(entry.id))
      .map((entry) => entry.lineIndex),
  );

  return lines.filter((_, index) => !removedIndexes.has(index));
}

function rewritePrefixedId(
  line: string,
  prefix: string,
  baseId: number,
  minId: number,
  requireStarAfterId: boolean,
): string | null {
  if (!line.startsWith(prefix)) {
    return null;
  }

  const rest = line.slice(prefix.length);
  const digits = rest.match(/^\d{2,4}/)?.[0];
  if (!digits) {
    return null;
  }

  const id = Number(digits);
  if (id < minId) {
    return null;
  }

  const suffix = rest.slice(digits.length);
  if (requireStarAfterId && !suffix.startsWith("*")) {
    return null;
  }

  const nextId =
    id >= baseId && id < APERTURE_MAX_ID
      ? id + 1
      : id;

  if (nextId === id) {
    return null;
  }

  return `${prefix}${nextId}${suffix}`;
}

function shiftApertureIds(lines: string[], baseId: number): string[] {
  return lines.map((line) => {
    return (
      rewritePrefixedId(line, "%ADD", baseId, APERTURE_MIN_ID, false) ??
      rewritePrefixedId(line, "G54D", baseId, APERTURE_MIN_ID, false) ??
      rewritePrefixedId(line, "D", baseId, APERTURE_MIN_ID, true) ??
      line
    );
  });
}

function deriveMd5Pair(input: string): string {
  const digest = SparkMD5.hash(input);
  const lastByte = Number.parseInt(digest.slice(-2), 16);
  return String(lastByte % 100).padStart(2, "0");
}

function buildSignatureLine(
  selectedLine: string,
  selectedId: number,
  pair: string,
  rng: SeededRandom,
): string {
  const baseLine = NUMBER_PATTERN.test(selectedLine)
    ? selectedLine
    : `%ADD${selectedId}C,${rng.next().toFixed(4)}*%`;

  return baseLine.replace(NUMBER_PATTERN, (_, value: string) => {
    const base = Number.parseFloat(value) || 0.01;
    let merged = `${base.toFixed(2)}${pair}`;

    if (Number.parseFloat(merged) === 0) {
      merged = "0.0100";
    }

    return `,${merged}`;
  });
}

function findInsertIndex(lines: string[], selectedId: number): number {
  const addLines = collectAddLines(lines);
  if (addLines.length === 0) {
    return 0;
  }

  const addLineById = new Map(addLines.map((entry) => [entry.id, entry.lineIndex]));
  const nextId = selectedId + 1;

  if (addLineById.has(nextId)) {
    return addLineById.get(nextId) ?? 0;
  }

  return (addLines.at(-1)?.lineIndex ?? -1) + 1;
}

export function injectLcedaSignature(
  content: string,
  rng: SeededRandom,
  importedMode = false,
): string {
  const { layout, lines } = splitText(content);
  const keptLines = stripUnusedAddLines(lines);
  const addLines = collectAddLines(keptLines);

  if (addLines.length === 0) {
    return joinText(keptLines, layout);
  }

  const pickIndex = 5 + rng.integer(0, 4);
  const selected = addLines[Math.min(pickIndex, addLines.length - 1)];
  if (!selected) {
    return joinText(keptLines, layout);
  }

  const shiftedLines = shiftApertureIds(keptLines, selected.id);
  const shiftedText = joinText(shiftedLines, layout);
  const hashBase = importedMode ? `494d${shiftedText}` : shiftedText;
  const signatureLine = buildSignatureLine(
    selected.line,
    selected.id,
    deriveMd5Pair(hashBase),
    rng,
  );

  shiftedLines.splice(findInsertIndex(shiftedLines, selected.id), 0, signatureLine);
  return joinText(shiftedLines, layout);
}
