import { describe, expect, it } from 'vitest';
import { buildOpenBBRuntimeDataset, repairInterruptedOpenBBJobs, type OpenBBJob } from './openbbAdminService';

function job(overrides: Partial<OpenBBJob> = {}): OpenBBJob {
  return {
    jobId: 'obb_1234567890abcdef1234567890abcdef',
    status: 'succeeded',
    createdAt: '2026-09-17T10:00:00.000Z',
    startedAt: '2026-09-17T10:00:01.000Z',
    completedAt: '2026-09-17T10:00:03.000Z',
    archivePath: 'C:/terminal/vendor/OpenBB-develop/OpenBB-develop.zip',
    archiveSha256: 'a'.repeat(64),
    entryCount: 2711,
    command: 'GET / + GET /openapi.json + SHA-256 OpenBB-develop.zip',
    log: [],
    error: null,
    resultSummary: {
      actorUserId: 7,
      checkedAt: '2026-09-17T10:00:02.000Z',
      apiBaseUrl: 'http://127.0.0.1:6900',
      apiReachable: true,
      apiStatusCode: 200,
      apiLatencyMs: 12,
      openApiReachable: true,
      openApiTitle: 'OpenBB Platform API',
      openApiVersion: '1.0.0',
      openApiPathCount: 438,
      openApiTagCount: 16,
      archiveVerified: true,
      archiveActualSha256: 'a'.repeat(64),
    },
    push: null,
    ...overrides,
  };
}

describe('legacy OpenBB task completion contract', () => {
  it('converts abandoned running jobs into explicit failures', () => {
    const running = job({ status: 'running', completedAt: null, startedAt: '2026-09-17T09:00:00.000Z', resultSummary: null });
    const repaired = repairInterruptedOpenBBJobs([running], Date.parse('2026-09-17T10:00:00.000Z'));
    expect(repaired.changed).toBe(true);
    expect(repaired.jobs[0]).toMatchObject({ status: 'failed', error: 'OPENBB_JOB_INTERRUPTED' });
    expect(repaired.jobs[0].completedAt).toBe('2026-09-17T10:00:00.000Z');
  });

  it('keeps a recent running job available for its real completion', () => {
    const running = job({ status: 'running', completedAt: null, startedAt: '2026-09-17T09:59:00.000Z', resultSummary: null });
    const repaired = repairInterruptedOpenBBJobs([running], Date.parse('2026-09-17T10:00:00.000Z'));
    expect(repaired.changed).toBe(false);
    expect(repaired.jobs[0].status).toBe('running');
  });

  it('builds a declarative dataset only from verified task evidence', () => {
    const dataset = buildOpenBBRuntimeDataset(job());
    expect(dataset).toMatchObject({ endpointId: 'openbb_runtime_audit', columns: ['check', 'status', 'value', 'source', 'observedAt'] });
    expect(dataset.rows).toHaveLength(4);
    expect(dataset.rows[0]).toMatchObject({ check: 'OpenBB API', status: 'available', source: 'http://127.0.0.1:6900' });
    expect(dataset.metadata).toMatchObject({ rowCount: 4, quality: 'provider_response', schemaVersion: 'openbb-query-v1' });
    expect(dataset.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('refuses to manufacture a push dataset for incomplete or failed jobs', () => {
    expect(() => buildOpenBBRuntimeDataset(job({ status: 'failed' }))).toThrow('OPENBB_JOB_NOT_READY_FOR_PUSH');
    expect(() => buildOpenBBRuntimeDataset(job({ status: 'running', completedAt: null }))).toThrow('OPENBB_JOB_NOT_READY_FOR_PUSH');
  });
});
