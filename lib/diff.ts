import { diffLines, diffWordsWithSpace, type Change } from 'diff';
import type { DiffRow, DiffRowType, WordDiffChunk } from './types';

export function normalizeTrailingNewlines(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.trim() && !normalized.includes('\n')) {
    return normalized;
  }
  return normalized.replace(/\n+$/, '');
}

function splitIntoLines(value: string): string[] {
  if (value.length === 0) return [];
  // If ends with newline, slice off the trailing newline before splitting
  const content = value.endsWith('\n') ? value.slice(0, -1) : value;
  return content.split('\n');
}

export function buildDiffRows(previous: string, current: string): DiffRow[] {
  const normPrev = normalizeTrailingNewlines(previous);
  const normCurr = normalizeTrailingNewlines(current);

  if (!normPrev && !normCurr) {
    return [];
  }

  const changes: Change[] = diffLines(normPrev, normCurr);
  const rows: DiffRow[] = [];

  let oldLine = 1;
  let newLine = 1;
  let rowCounter = 0;

  // We walk through changes and group consecutive removed and added blocks for word-level pairing
  let i = 0;
  while (i < changes.length) {
    const change = changes[i];

    if (!change.added && !change.removed) {
      // Unchanged block
      const lines = splitIntoLines(change.value);
      for (const line of lines) {
        rows.push({
          id: `diff-row-${rowCounter++}`,
          type: 'unchanged',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          content: line,
          trimmedText: line.trim(),
        });
      }
      i++;
    } else {
      // Edit block: collect consecutive removed and added changes
      let removedLines: string[] = [];
      let addedLines: string[] = [];

      while (i < changes.length && (changes[i].added || changes[i].removed)) {
        if (changes[i].removed) {
          removedLines = removedLines.concat(splitIntoLines(changes[i].value));
        } else if (changes[i].added) {
          addedLines = addedLines.concat(splitIntoLines(changes[i].value));
        }
        i++;
      }

      const pairs = Math.min(removedLines.length, addedLines.length);

      // 1. Process paired removed lines
      for (let p = 0; p < removedLines.length; p++) {
        const line = removedLines[p];
        let wordChunks: WordDiffChunk[] | undefined;

        if (p < pairs) {
          const wordDiff = diffWordsWithSpace(line, addedLines[p]);
          // For removed line, keep chunks that were in the original (unchanged or removed)
          wordChunks = wordDiff
            .filter((c) => !c.added)
            .map((c) => ({
              value: c.value,
              removed: c.removed,
            }));
        }

        rows.push({
          id: `diff-row-${rowCounter++}`,
          type: 'removed',
          oldLineNumber: oldLine++,
          newLineNumber: null,
          content: line,
          trimmedText: line.trim(),
          wordChunks,
        });
      }

      // 2. Process paired added lines
      for (let p = 0; p < addedLines.length; p++) {
        const line = addedLines[p];
        let wordChunks: WordDiffChunk[] | undefined;

        if (p < pairs) {
          const wordDiff = diffWordsWithSpace(removedLines[p], line);
          // For added line, keep chunks that are in the new version (unchanged or added)
          wordChunks = wordDiff
            .filter((c) => !c.removed)
            .map((c) => ({
              value: c.value,
              added: c.added,
            }));
        }

        rows.push({
          id: `diff-row-${rowCounter++}`,
          type: 'added',
          oldLineNumber: null,
          newLineNumber: newLine++,
          content: line,
          trimmedText: line.trim(),
          wordChunks,
        });
      }
    }
  }

  return rows;
}

/**
 * Filters rows for "Changes only" mode with 2 lines of context.
 * Inserts a separator row for collapsed regions.
 */
export function filterChangesOnly(rows: DiffRow[], contextLines: number = 2): DiffRow[] {
  if (rows.length === 0) return [];

  // Identify all changed indices
  const changedIndices: number[] = [];
  rows.forEach((row, idx) => {
    if (row.type === 'added' || row.type === 'removed') {
      changedIndices.push(idx);
    }
  });

  // If there are no changes, return empty or full rows
  if (changedIndices.length === 0) {
    return rows;
  }

  // Calculate visible indices
  const isVisible = new Array<boolean>(rows.length).fill(false);
  for (const idx of changedIndices) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(rows.length - 1, idx + contextLines);
    for (let j = start; j <= end; j++) {
      isVisible[j] = true;
    }
  }

  const result: DiffRow[] = [];
  let inSkippedRegion = false;
  let separatorId = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    if (isVisible[idx]) {
      inSkippedRegion = false;
      result.push(rows[idx]);
    } else {
      if (!inSkippedRegion) {
        inSkippedRegion = true;
        result.push({
          id: `separator-${separatorId++}`,
          type: 'separator',
          oldLineNumber: null,
          newLineNumber: null,
          content: '⋯',
          trimmedText: '⋯',
        });
      }
    }
  }

  return result;
}

