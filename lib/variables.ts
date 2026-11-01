import type {
  BrokenPlaceholder,
  DiffRow,
  VariableComparison,
  VariableOccurrence,
  VariableStatus,
} from './types';

/**
 * Escapes regex special characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts variables matching /$\{([^}\n]*)\}/g from a prompt.
 * Trims names and ignores empty names.
 */
export function extractVariables(prompt: string): Map<string, VariableOccurrence> {
  const map = new Map<string, VariableOccurrence>();
  if (!prompt) return map;

  const lines = prompt.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;
    const regex = /\$\{([^}\n]*)\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const rawName = match[1];
      const trimmed = rawName.trim();
      if (!trimmed) continue;

      const existing = map.get(trimmed);
      if (existing) {
        existing.count += 1;
        existing.lines.push(lineNumber);
      } else {
        map.set(trimmed, {
          name: trimmed,
          count: 1,
          lines: [lineNumber],
        });
      }
    }
  }

  return map;
}

/**
 * Compares variables between previous and current prompts.
 * Sorted in order: removed, new, changed, same.
 */
export function compareVariables(previous: string, current: string): VariableComparison[] {
  const prevMap = extractVariables(previous);
  const currMap = extractVariables(current);

  const allKeys = new Set<string>();
  prevMap.forEach((_, key) => allKeys.add(key));
  currMap.forEach((_, key) => allKeys.add(key));
  const comparisons: VariableComparison[] = [];

  for (const key of allKeys) {
    const prevVar = prevMap.get(key);
    const currVar = currMap.get(key);

    let status: VariableStatus;
    if (currVar && !prevVar) {
      status = 'new';
    } else if (prevVar && !currVar) {
      status = 'removed';
    } else if (prevVar && currVar && prevVar.count !== currVar.count) {
      status = 'changed';
    } else {
      status = 'same';
    }

    comparisons.push({
      name: key,
      status,
      beforeCount: prevVar ? prevVar.count : 0,
      beforeLines: prevVar ? prevVar.lines : [],
      afterCount: currVar ? currVar.count : 0,
      afterLines: currVar ? currVar.lines : [],
    });
  }

  const orderPriority: Record<VariableStatus, number> = {
    removed: 0,
    new: 1,
    changed: 2,
    same: 3,
  };

  return comparisons.sort((a, b) => {
    const prioDiff = orderPriority[a.status] - orderPriority[b.status];
    if (prioDiff !== 0) return prioDiff;
    return a.name.localeCompare(b.name);
  });
}

function createSnippet(line: string, startIndex: number, length: number): string {
  if (line.length <= 70) {
    return line;
  }
  const half = Math.floor((70 - length) / 2);
  let start = Math.max(0, startIndex - half);
  let end = Math.min(line.length, start + 70);

  if (end - start < 70) {
    start = Math.max(0, end - 70);
  }

  let snip = line.slice(start, end);
  if (start > 0) snip = '…' + snip.slice(1);
  if (end < line.length) snip = snip.slice(0, -1) + '…';
  return snip.slice(0, 70);
}

/**
 * Finds broken placeholders in the given prompt (typically the current prompt).
 * Checks for:
 * 1. ${weather - missing closing brace: /\$\{(?![^{}\n]*\})/
 * 2. {weather} - missing $ (excluding JSON)
 * 3. $ {weather} - space between $ and {
 * 4. ${} - empty placeholder
 * 5. ${ weather } - extra spaces inside braces
 */
export function findBrokenPlaceholders(prompt: string): BrokenPlaceholder[] {
  if (!prompt) return [];
  const lines = prompt.split('\n');
  const results: BrokenPlaceholder[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // 1. Unclosed placeholder: /\$\{(?![^{}\n]*\})/g
    // Instructed: use /\$\{(?![^{}\n]*\})/ so `${broken and ${ok}` is flagged on first ${
    const unclosedRegex = /\$\{(?![^{}\n]*\})/g;
    let match: RegExpExecArray | null;
    while ((match = unclosedRegex.exec(line)) !== null) {
      results.push({
        line: lineNumber,
        message: 'Missing closing brace `}`',
        snippet: createSnippet(line, match.index, 2),
      });
    }

    // 2. Space between $ and {: /\$\s+\{([^}\n]*)\}/g
    const spaceRegex = /\$\s+\{([^}\n]*)\}/g;
    while ((match = spaceRegex.exec(line)) !== null) {
      results.push({
        line: lineNumber,
        message: "Space between '$' and '{'",
        snippet: createSnippet(line, match.index, match[0].length),
      });
    }

    // 3. Empty placeholder: /\$\{\s*\}/g
    const emptyRegex = /\$\{\s*\}/g;
    while ((match = emptyRegex.exec(line)) !== null) {
      results.push({
        line: lineNumber,
        message: "Empty placeholder '${}'",
        snippet: createSnippet(line, match.index, match[0].length),
      });
    }

    // 4. Extra spaces inside braces: e.g. `${ weather }` or `${ weather}` or `${weather }`
    // Ensure not empty (${} was already flagged)
    const extraSpaceRegex = /\$\{(\s+[^\s}\n]+[^\n}]*|[^\n}]+?\s+)\}/g;
    while ((match = extraSpaceRegex.exec(line)) !== null) {
      if (match[1].trim().length > 0) {
        results.push({
          line: lineNumber,
          message: 'Extra spaces inside braces',
          snippet: createSnippet(line, match.index, match[0].length),
        });
      }
    }

    // 5. Missing $: {identifier}
    // Must NOT be preceded by $ (even with spaces)
    // Must NOT be JSON like {"key": 1} or { "key": "value" }
    // Only strictly match {identifier} where identifier is a single variable name
    const missingDollarRegex = /(^|[^\$])\{(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)\}/g;
    while ((match = missingDollarRegex.exec(line)) !== null) {
      // Check prefix before match
      const prefix = match[1];
      const matchStart = match.index + prefix.length;
      const textBefore = line.slice(0, matchStart).trimEnd();

      // If preceded by $, it's handled by other checks
      if (textBefore.endsWith('$')) {
        continue;
      }

      results.push({
        line: lineNumber,
        message: "Missing '$' prefix",
        snippet: createSnippet(line, matchStart, match[0].length - prefix.length),
      });
    }
  }

  return results;
}

export interface TextSegment {
  text: string;
  isVariable: boolean;
}

/**
 * Splits a string into literal text and variable chip tokens (${...}).
 * Used to render purple chips for variables in diff rows.
 */
export function splitPlaceholders(text: string): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  const regex = /(\$\{[^}\n]+\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isVariable: false,
      });
    }
    segments.push({
      text: match[1],
      isVariable: true,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isVariable: false,
    });
  }

  return segments;
}

/**
 * Finds diff row indices whose content contains the variable (trimmed name).
 * User rule:
 * - Removed variables jump to removed rows
 * - New variables jump to added rows
 * - Changed or same variables cycle through all rows containing them
 */
export function findMatchingDiffRowIndices(
  rows: DiffRow[],
  varName: string,
  status: VariableStatus
): number[] {
  const trimmed = varName.trim();
  if (!trimmed) return [];

  // Match ${ trimmed } with optional spaces
  const pattern = new RegExp(`\\$\\{\\s*${escapeRegExp(trimmed)}\\s*\\}`);
  const matchingIndices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.type === 'separator') continue;

    if (status === 'removed' && row.type !== 'removed') continue;
    if (status === 'new' && row.type !== 'added') continue;

    if (pattern.test(row.content)) {
      matchingIndices.push(i);
    }
  }

  return matchingIndices;
}
