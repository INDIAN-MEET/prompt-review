export type VariableStatus = 'removed' | 'new' | 'changed' | 'same';

export interface VariableOccurrence {
  name: string;
  count: number;
  lines: number[]; // 1-based line numbers in the respective prompt
}

export interface VariableComparison {
  name: string;
  status: VariableStatus;
  beforeCount: number;
  beforeLines: number[];
  afterCount: number;
  afterLines: number[];
}

export interface BrokenPlaceholder {
  line: number;
  message: string;
  snippet: string;
}

export type DiffRowType = 'added' | 'removed' | 'unchanged' | 'separator';

export interface WordDiffChunk {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffRow {
  id: string;
  type: DiffRowType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
  trimmedText: string;
  wordChunks?: WordDiffChunk[];
  isHiddenByFilter?: boolean;
}

export interface VersionSnapshot {
  id: string;
  note: string;
  text: string;
  createdAt: number;
}

export interface LineComment {
  id: string;
  lineTextTrimmed: string;
  author: string;
  text: string;
  createdAt: number;
}

export interface GitHubFileResult {
  previousText: string;
  currentText: string;
  previousSha?: string;
  currentSha?: string;
  path: string;
}

