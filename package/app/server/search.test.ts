import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unifiedSearch, getSearchSuggestions } from './search-db';

describe('Search Database Functions', () => {
  describe('unifiedSearch', () => {
    it('should return empty array for empty query', async () => {
      const results = await unifiedSearch('');
      expect(results).toEqual([]);
    });

    it('should return search results for valid query', async () => {
      const results = await unifiedSearch('US');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results with correct structure', async () => {
      const results = await unifiedSearch('curve');
      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('name');
        expect(['curve', 'fund', 'market']).toContain(result.type);
      }
    });

    it('should limit results to 20', async () => {
      const results = await unifiedSearch('a');
      expect(results.length).toBeLessThanOrEqual(20);
    });

    it('should handle special characters in query', async () => {
      const results = await unifiedSearch('%');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return empty array for empty query', async () => {
      const suggestions = await getSearchSuggestions('');
      expect(suggestions).toEqual([]);
    });

    it('should return suggestions for valid query', async () => {
      const suggestions = await getSearchSuggestions('US');
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should return string array', async () => {
      const suggestions = await getSearchSuggestions('fund');
      if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
          expect(typeof suggestion).toBe('string');
        });
      }
    });

    it('should limit suggestions to 10', async () => {
      const suggestions = await getSearchSuggestions('a');
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });
});
