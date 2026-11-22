import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const directory = resolve('supabase/migrations');
const sql = readdirSync(directory).filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(resolve(directory, file), 'utf8')).join('\n');

describe('גבולות סכמה לפני הפעלה בענן', () => {
  it('מגדירה את 17 ישויות המוצר בלבד', () => {
    expect([...sql.matchAll(/create table public\.(\w+)/gi)]).toHaveLength(17);
  });
  it('חוסמת כתיבה ישירה וברירת מחדל של EXECUTE', () => {
    expect(sql).toContain('revoke all on all tables in schema public from anon, authenticated, service_role');
    expect(sql).toContain('alter default privileges in schema public revoke execute on functions from public');
  });
  it('כוללת אימות סשן אמיתי וטריגרים למקור ולהיסטוריה', () => {
    expect(sql).toContain('auth.sessions');
    expect(sql).toContain('sessions_valid_after');
    expect(sql).toContain('create trigger immutable_diary_versions');
    expect(sql).toContain('create trigger immutable_stored_files');
  });
});
