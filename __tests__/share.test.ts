import { describe, it, expect } from 'vitest';
import { encodeShareHash, decodeShareHash, createShareUrl } from '../lib/share';

describe('share hash encoding and decoding', () => {
  it('encodes and decodes prompt payloads correctly', () => {
    const original = {
      previous: 'Hello ${user} in ${city}!\nSpecial chars: &<>"\' 🚀',
      current: 'Hello ${user} in ${metropolis}!\nSpecial chars: &<>"\' 🚀',
    };

    const hash = encodeShareHash(original);
    expect(hash.startsWith('#d=')).toBe(true);

    const decoded = decodeShareHash(hash);
    expect(decoded).toEqual(original);
  });

  it('handles empty strings in payloads', () => {
    const original = {
      previous: '',
      current: '',
    };
    const hash = encodeShareHash(original);
    const decoded = decodeShareHash(hash);
    expect(decoded).toEqual(original);
  });

  it('returns null on invalid or corrupted hash', () => {
    expect(decodeShareHash('')).toBeNull();
    expect(decodeShareHash('#invalid')).toBeNull();
    expect(decodeShareHash('#d=!!!notbase64')).toBeNull();
  });

  it('flags URLs exceeding length limit', () => {
    const shortPayload = { previous: 'short', current: 'short' };
    const shortResult = createShareUrl('https://example.com', '/', shortPayload);
    expect(shortResult.isTooLong).toBe(false);

    // Create a very large payload
    const longPayload = {
      previous: 'A'.repeat(7000),
      current: 'B'.repeat(7000),
    };
    const longResult = createShareUrl('https://example.com', '/', longPayload);
    expect(longResult.isTooLong).toBe(true);
    expect(longResult.length).toBeGreaterThan(8000);
  });
});
