export interface SharePayload {
  previous: string;
  current: string;
}

export const SHARE_HASH_PREFIX = '#d=';
export const MAX_SHARE_LINK_LENGTH = 8000;

/**
 * Encodes previous and current prompts into a URL hash string.
 * Format: #d= + base64(encodeURIComponent(JSON))
 */
export function encodeShareHash(payload: SharePayload): string {
  const jsonStr = JSON.stringify({
    previous: payload.previous || '',
    current: payload.current || '',
  });

  const uriEncoded = encodeURIComponent(jsonStr);

  let base64: string;
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    base64 = window.btoa(uriEncoded);
  } else {
    base64 = Buffer.from(uriEncoded, 'utf-8').toString('base64');
  }

  return `${SHARE_HASH_PREFIX}${base64}`;
}

/**
 * Decodes a URL hash string back into previous and current prompts.
 * Returns null if the hash is missing or corrupted.
 */
export function decodeShareHash(hash: string): SharePayload | null {
  if (!hash || !hash.startsWith(SHARE_HASH_PREFIX)) {
    return null;
  }

  const base64 = hash.slice(SHARE_HASH_PREFIX.length).trim();
  if (!base64) return null;

  try {
    let uriEncoded: string;
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      uriEncoded = window.atob(base64);
    } else {
      uriEncoded = Buffer.from(base64, 'base64').toString('utf-8');
    }

    const jsonStr = decodeURIComponent(uriEncoded);
    const parsed = JSON.parse(jsonStr);

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.previous === 'string' &&
      typeof parsed.current === 'string'
    ) {
      return {
        previous: parsed.previous,
        current: parsed.current,
      };
    }
  } catch (err) {
    console.warn('Failed to decode share hash:', err);
  }

  return null;
}

/**
 * Generates the full share URL and checks if it exceeds 8,000 characters.
 */
export function createShareUrl(
  origin: string,
  pathname: string,
  payload: SharePayload
): { url: string; isTooLong: boolean; length: number } {
  const hash = encodeShareHash(payload);
  const url = `${origin}${pathname}${hash}`;
  return {
    url,
    isTooLong: url.length > MAX_SHARE_LINK_LENGTH,
    length: url.length,
  };
}

