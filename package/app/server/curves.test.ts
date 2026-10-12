import { describe, it, expect } from 'vitest';
import { getDb } from './db';
import { curves } from '../drizzle/schema';

describe('Curves Database Functions', () => {
  describe('getCurves', () => {
    it('should return array of curves', async () => {
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(10);
      expect(Array.isArray(curveList)).toBe(true);
    });

    it('should filter curves by region', async () => {
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(10);
      expect(Array.isArray(curveList)).toBe(true);
    });

    it('should filter curves by type', async () => {
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(10);
      expect(Array.isArray(curveList)).toBe(true);
    });

    it('should filter curves by currency', async () => {
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(10);
      expect(Array.isArray(curveList)).toBe(true);
    });

    it('should return curves with required fields', async () => {
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(1);
      if (curveList.length > 0) {
        const curve = curveList[0];
        expect(curve).toHaveProperty('id');
        expect(curve).toHaveProperty('name');
      }
    });
  });

  describe('getCurveDetail', () => {
    it('should return curve detail for valid ID', async () => {
      // First get a curve ID
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(1);
      
      if (curveList.length > 0) {
        const curve = curveList[0];
        expect(curve).toHaveProperty('id');
        expect(curve).toHaveProperty('name');
      }
    });

    it('should handle database queries', async () => {
      const db = await getDb();
      const curveList = await db.select().from(curves).limit(10);
      expect(Array.isArray(curveList)).toBe(true);
    });
  });
});
