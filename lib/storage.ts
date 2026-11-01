import { get, set } from 'idb-keyval';
import type { LineComment, VersionSnapshot } from './types';

const STORAGE_KEYS = {
  VERSIONS: 'prompt_diff_versions_v1',
  AUTHOR: 'prompt_diff_author_v1',
  COMMENTS: 'prompt_diff_comments_v1',
} as const;

// In-memory fallback if IndexedDB is unavailable
const memoryFallback = new Map<string, unknown>();

async function safeGet<T>(key: string, defaultValue: T): Promise<T> {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = await get<T>(key);
    return val !== undefined ? val : defaultValue;
  } catch (err) {
    console.warn(`IndexedDB read error for ${key}:`, err);
    return (memoryFallback.get(key) as T) ?? defaultValue;
  }
}

async function safeSet<T>(key: string, value: T): Promise<void> {
  if (typeof window === 'undefined') return;
  memoryFallback.set(key, value);
  try {
    await set(key, value);
  } catch (err) {
    console.warn(`IndexedDB write error for ${key}:`, err);
  }
}

// ----------------- Versions -----------------
export async function getSavedVersions(): Promise<VersionSnapshot[]> {
  const versions = await safeGet<VersionSnapshot[]>(STORAGE_KEYS.VERSIONS, []);
  return versions.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveVersion(note: string, text: string): Promise<VersionSnapshot> {
  const versions = await getSavedVersions();
  const newSnapshot: VersionSnapshot = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    note: note.trim() || 'Untitled version',
    text,
    createdAt: Date.now(),
  };

  const updated = [newSnapshot, ...versions];
  await safeSet(STORAGE_KEYS.VERSIONS, updated);
  return newSnapshot;
}

export async function deleteSavedVersion(id: string): Promise<void> {
  const versions = await getSavedVersions();
  const updated = versions.filter((v) => v.id !== id);
  await safeSet(STORAGE_KEYS.VERSIONS, updated);
}

// ----------------- Author Name -----------------
export async function getStoredAuthor(): Promise<string> {
  return await safeGet<string>(STORAGE_KEYS.AUTHOR, 'Anonymous');
}

export async function saveStoredAuthor(author: string): Promise<void> {
  await safeSet<string>(STORAGE_KEYS.AUTHOR, author.trim() || 'Anonymous');
}

// ----------------- Line Comments -----------------
export async function getStoredComments(): Promise<LineComment[]> {
  return await safeGet<LineComment[]>(STORAGE_KEYS.COMMENTS, []);
}

export async function addComment(
  lineTextTrimmed: string,
  author: string,
  text: string
): Promise<LineComment> {
  const current = await getStoredComments();
  const newComment: LineComment = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    lineTextTrimmed,
    author: author.trim() || 'Anonymous',
    text: text.trim(),
    createdAt: Date.now(),
  };

  const updated = [...current, newComment];
  await safeSet(STORAGE_KEYS.COMMENTS, updated);
  return newComment;
}

export async function deleteStoredComment(id: string): Promise<void> {
  const current = await getStoredComments();
  const updated = current.filter((c) => c.id !== id);
  await safeSet(STORAGE_KEYS.COMMENTS, updated);
}

/**
 * Builds a Map of comments keyed by trimmed line text.
 * Keeps 2,000+ line prompts fast.
 */
export function buildCommentsMap(comments: LineComment[]): Map<string, LineComment[]> {
  const map = new Map<string, LineComment[]>();
  for (const c of comments) {
    const list = map.get(c.lineTextTrimmed);
    if (list) {
      list.push(c);
    } else {
      map.set(c.lineTextTrimmed, [c]);
    }
  }
  return map;
}

