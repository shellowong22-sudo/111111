import { describe, expect, it } from 'vitest';
import { forexTimelinePresetCodec } from './forexTimelinePresetDb';

describe('forex same-day timeline preset codec', () => {
  it('round-trips unique account-filter values without storing event or market data', () => {
    const encoded = forexTimelinePresetCodec.encode(['FED', 'BOE', 'FED']);
    expect(encoded).toBe('["FED","BOE"]');
    expect(forexTimelinePresetCodec.decode(encoded)).toEqual(['FED', 'BOE']);
  });

  it('turns malformed or non-string stored JSON into a safe empty condition list', () => {
    expect(forexTimelinePresetCodec.decode('{bad')).toEqual([]);
    expect(forexTimelinePresetCodec.decode('[1,"FED"]')).toEqual([]);
  });
});
