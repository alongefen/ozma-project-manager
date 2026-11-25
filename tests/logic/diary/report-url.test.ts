import { describe, expect, it } from 'vitest';
import { ALL_REPORTS_FROM, ALL_REPORTS_TO, reportUrl } from '../../../src/features/diary/shared/model';

describe('reportUrl range', () => {
  it('builds a range query and the all-reports sentinel', () => {
    const projectId = '95820c6e-e329-4c37-a6a3-cd4d391be79c';
    expect(reportUrl({ kind: 'range', projectId, from: '2026-11-01', to: '2026-11-25' }, { part: 2, download: true }))
      .toBe(`/api/reports/diary?kind=range&projectId=${projectId}&from=2026-11-01&to=2026-11-25&part=2&download=1`);
    expect(reportUrl({ kind: 'range', projectId, from: ALL_REPORTS_FROM, to: ALL_REPORTS_TO })).toContain('from=2000-01-01&to=2099-12-31');
  });
});
