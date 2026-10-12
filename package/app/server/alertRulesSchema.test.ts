import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('alert rules restored schema boundary', () => {
  it('keeps the alert tables defined by the original project migration but absent from the ZIP dump', () => {
    const baselineDump = read('/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql');
    const migration = read('server/do-migrate.mjs');

    expect(baselineDump).not.toMatch(/CREATE TABLE `alert_rules`/);
    expect(baselineDump).not.toMatch(/CREATE TABLE `alert_triggers`/);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alert_rules');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alert_triggers');
    expect(migration).toContain("rule_type ENUM('price_above','price_below','var_above','var_below','return_above','return_below','volatility_above','volatility_below')");
  });

  it('keeps the protected list operation read-only and user scoped', () => {
    const router = read('server/routers/alert.ts');

    expect(router).toContain('listRules: protectedProcedure');
    expect(router).toContain('FROM alert_rules');
    expect(router).toContain('WHERE user_id = ${ctx.user.id}');
    expect(router).toContain('ORDER BY created_at DESC');
  });
});
