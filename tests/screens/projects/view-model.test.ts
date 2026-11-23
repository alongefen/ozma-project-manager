import { describe, expect, it } from 'vitest';
import { actionsFor, coverSrc, dateText, errorText, isReadOnlyProject, managersText, orNotEntered, sectionsFor, statusLabel, telHref } from '@/features/projects/shared/view-model';
import type { ProjectPermissions } from '@/types/contracts';

const perms = (over: Partial<ProjectPermissions> = {}): ProjectPermissions => ({ view: true, editDetails: false, uploadDocument: false, manageAccess: false, writeTasks: false, deleteTasks: false, report: true, viewFinance: false, writeFinance: false, cancelTransaction: false, ...over });
const id = '11111111-1111-4111-8111-111111111111';

describe('project file view model', () => {
  it('offers finance only when the database allowed it, and always links the other sections', () => {
    expect(sectionsFor({ id, permissions: perms() }).map(s => s.key)).toEqual(['files', 'tasks', 'diary']);
    const withFinance = sectionsFor({ id, permissions: perms({ viewFinance: true }) });
    expect(withFinance.map(s => s.key)).toEqual(['files', 'tasks', 'diary', 'finance']);
    expect(withFinance.every(s => s.href.startsWith(`/projects/${id}/`))).toBe(true);
  });
  it('shows owner actions only to whoever has manageAccess, edit only to editDetails', () => {
    expect(actionsFor({ permissions: perms() })).toEqual({ edit: false, manage: false, showBusinessNumber: false });
    expect(actionsFor({ permissions: perms({ editDetails: true }) })).toEqual({ edit: true, manage: false, showBusinessNumber: false });
    expect(actionsFor({ permissions: perms({ editDetails: true, manageAccess: true }), businessNumber: null })).toEqual({ edit: true, manage: true, showBusinessNumber: true });
  });
  it('hides the business number field unless the payload carried it (owner only)', () => {
    expect(actionsFor({ permissions: perms({ editDetails: true }), businessNumber: undefined }).showBusinessNumber).toBe(false);
  });
  it('labels status and read-only states', () => {
    expect(statusLabel({ status: 'active', archived: false })).toBe('פעיל');
    expect(statusLabel({ status: 'completed', archived: false })).toBe('הסתיים');
    expect(statusLabel({ status: 'active', archived: true })).toBe('בארכיון');
    expect(isReadOnlyProject({ status: 'completed', archived: false })).toBe(true);
    expect(isReadOnlyProject({ status: 'active', archived: false })).toBe(false);
  });
  it('uses the agreed empty-state texts', () => {
    expect(managersText([])).toBe('לא שויך מנהל');
    expect(managersText(['דנה', 'יוסי'])).toBe('דנה, יוסי');
    expect(orNotEntered(null)).toBe('לא הוזן');
    expect(orNotEntered('  ')).toBe('לא הוזן');
    expect(dateText(null)).toBe('לא הוזן');
    expect(dateText('2026-03-07')).toBe('07.03.2026');
  });
  it('builds a tel link only for dialable numbers and a cover url only for a file', () => {
    expect(telHref('050-123 4567')).toBe('tel:0501234567');
    expect(telHref('12')).toBeNull();
    expect(coverSrc(null)).toBeNull();
    expect(coverSrc(id)).toBe(`/api/storage/files/${id}?variant=display`);
  });
  it('maps error codes to Hebrew without provider text', () => {
    expect(errorText('CONFLICT')).toContain('השתנה');
    expect(errorText('FORBIDDEN')).toContain('הרשאה');
    expect(errorText('SOMETHING_ELSE')).toBe(errorText('UNAVAILABLE'));
  });
});
