import { describe, it, expect } from 'vitest';
import { normalizeTrailingNewlines, buildDiffRows, filterChangesOnly } from '../lib/diff';

describe('normalizeTrailingNewlines', () => {
  it('normalizes CRLF to LF and strips trailing newlines', () => {
    expect(normalizeTrailingNewlines('hello\r\nworld\r\n\r\n')).toBe('hello\nworld');
    expect(normalizeTrailingNewlines('hello\nworld\n')).toBe('hello\nworld');
    expect(normalizeTrailingNewlines('hello world')).toBe('hello world');
  });

  it('keeps empty string empty', () => {
    expect(normalizeTrailingNewlines('')).toBe('');
  });

  it('avoids fake diffs when only trailing newlines differ', () => {
    const prev = 'prompt text';
    const curr = 'prompt text\n\n';
    const rows = buildDiffRows(prev, curr);
    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe('unchanged');
  });
});

describe('buildDiffRows and word diff pairing', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(buildDiffRows('', '')).toEqual([]);
  });

  it('handles identical inputs as unchanged', () => {
    const rows = buildDiffRows('Hello world\nSecond line', 'Hello world\nSecond line');
    expect(rows.length).toBe(2);
    expect(rows[0].type).toBe('unchanged');
    expect(rows[0].oldLineNumber).toBe(1);
    expect(rows[0].newLineNumber).toBe(1);
    expect(rows[1].type).toBe('unchanged');
    expect(rows[1].oldLineNumber).toBe(2);
    expect(rows[1].newLineNumber).toBe(2);
  });

  it('pairs removed and added lines in change blocks for word-level diff', () => {
    const prev = 'Hello Alice in Wonderland';
    const curr = 'Hello Bob in Wonderland';
    const rows = buildDiffRows(prev, curr);

    expect(rows.length).toBe(2);
    expect(rows[0].type).toBe('removed');
    expect(rows[0].oldLineNumber).toBe(1);
    expect(rows[0].newLineNumber).toBeNull();
    expect(rows[0].wordChunks).toBeDefined();

    expect(rows[1].type).toBe('added');
    expect(rows[1].oldLineNumber).toBeNull();
    expect(rows[1].newLineNumber).toBe(1);
    expect(rows[1].wordChunks).toBeDefined();

    // Verify word-level diff
    const removedWords = rows[0].wordChunks!;
    const addedWords = rows[1].wordChunks!;

    // Removed line should have 'Alice' marked as removed
    const aliceChunk = removedWords.find((w) => w.value.includes('Alice'));
    expect(aliceChunk?.removed).toBe(true);

    // Added line should have 'Bob' marked as added
    const bobChunk = addedWords.find((w) => w.value.includes('Bob'));
    expect(bobChunk?.added).toBe(true);
  });

  it('handles multi-line additions and deletions with unequal counts', () => {
    const prev = 'Line 1\nLine 2';
    const curr = 'Line 1\nLine 2 modified\nLine 3 added\nLine 4 added';
    const rows = buildDiffRows(prev, curr);

    expect(rows[0].type).toBe('unchanged');
    expect(rows[1].type).toBe('removed'); // Line 2
    expect(rows[2].type).toBe('added'); // Line 2 modified (paired with Line 2)
    expect(rows[3].type).toBe('added'); // Line 3 added
    expect(rows[4].type).toBe('added'); // Line 4 added
  });
});

describe('filterChangesOnly', () => {
  it('shows only changed lines plus 2 lines of context with separators', () => {
    const lines = [
      'Line 1',
      'Line 2',
      'Line 3',
      'Line 4',
      'Line 5',
      'Line 6 changed',
      'Line 7',
      'Line 8',
      'Line 9',
      'Line 10',
    ];
    const prev = lines.join('\n');
    const curr = lines.map((l) => (l === 'Line 6 changed' ? 'Line 6 replaced' : l)).join('\n');

    const allRows = buildDiffRows(prev, curr);
    const filtered = filterChangesOnly(allRows, 2);

    // Line 6 changed is around index 5 (or 5 & 6 after split into removed/added)
    // Context: 2 lines before (Line 4, Line 5) and 2 lines after (Line 7, Line 8)
    // Line 1-3 should be collapsed behind a separator
    // Line 9-10 should be collapsed behind a separator
    const separatorCount = filtered.filter((r) => r.type === 'separator').length;
    expect(separatorCount).toBeGreaterThanOrEqual(1);

    const hasChangedLine = filtered.some((r) => r.content.includes('replaced'));
    expect(hasChangedLine).toBe(true);
  });
});
