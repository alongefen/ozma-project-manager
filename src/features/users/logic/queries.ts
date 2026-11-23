import 'server-only';
import type { Platform, RequestContext, UserRow, UsersApi } from '@/types/contracts';
import { UsersApiInputSchemas } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { ownerOperation } from './shared';

const profileFields = 'id,full_name,email,is_owner,is_active,revision' as const;
const membershipFields = 'user_id,project_id,role,finance_access,revision' as const;

async function readUsers(platform: Platform, ctx: RequestContext, id?: string): Promise<UserRow[]> {
  const profiles = await platform.fetchAll(async (from, to) => {
    let query = ctx.db.from('profiles').select(profileFields).order('id').range(from, to);
    if (id) query = query.eq('id', id);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
  if (!profiles.length) return [];
  const memberships = await platform.fetchAll(async (from, to) => {
    let query = ctx.db.from('memberships').select(membershipFields).order('project_id').order('user_id').range(from, to);
    if (id) query = query.eq('user_id', id);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
  const projects = memberships.length ? await platform.fetchAll(async (from, to) => {
    const { data, error } = await ctx.db.from('projects').select('id,name').order('id').range(from, to);
    if (error) throw error;
    return data ?? [];
  }) : [];
  const names = new Map(projects.map(project => [project.id, project.name]));
  return profiles.map(profile => ({
    id: profile.id, fullName: profile.full_name, email: profile.email,
    isOwner: profile.is_owner, isActive: profile.is_active, revision: profile.revision,
    assignments: memberships.filter(member => member.user_id === profile.id).map(member => {
      const projectName = names.get(member.project_id);
      if (projectName === undefined) throw new Error('UNAVAILABLE');
      return { projectId: member.project_id, projectName, role: member.role, financeAccess: member.finance_access, revision: member.revision };
    }),
  }));
}

export function createUserQueries(platform: Platform) {
  return {
    listUsers: ownerOperation(platform, UsersApiInputSchemas.listUsers, async (ctx, input) => {
      const rows = await readUsers(platform, ctx);
      const search = platform.format.searchKey(input.search ?? '');
      return { ok: true as const, value: search ? rows.filter(row => platform.format.searchKey(`${row.fullName} ${row.email}`).includes(search)) : rows };
    }),
    getUser: ownerOperation(platform, UsersApiInputSchemas.getUser, async (ctx, input) => {
      const rows = await readUsers(platform, ctx, input.id);
      return rows[0] ? { ok: true as const, value: rows[0] } : failure('NOT_FOUND');
    }),
    listProjectMembers: ownerOperation(platform, UsersApiInputSchemas.listProjectMembers, async (ctx, input) => {
      const project = await ctx.db.from('projects').select('id').eq('id', input.projectId).maybeSingle();
      if (project.error) throw project.error;
      if (!project.data) return failure('NOT_FOUND');
      const memberships = await platform.fetchAll(async (from, to) => {
        const { data, error } = await ctx.db.from('memberships').select(membershipFields).eq('project_id', input.projectId).order('user_id').range(from, to);
        if (error) throw error;
        return data ?? [];
      });
      if (!memberships.length) return { ok: true as const, value: [] };
      // Read profiles in pages instead of an unbounded URL containing every member id.
      const profiles = await platform.fetchAll(async (from, to) => {
        const { data, error } = await ctx.db.from('profiles').select(profileFields).order('id').range(from, to);
        if (error) throw error;
        return data ?? [];
      });
      const byId = new Map(profiles.map(profile => [profile.id, profile]));
      const members = memberships.map(member => {
        const profile = byId.get(member.user_id);
        if (!profile) throw new Error('UNAVAILABLE');
        return { userId: profile.id, fullName: profile.full_name, role: member.role, financeAccess: member.finance_access, isActive: profile.is_active, revision: member.revision };
      });
      return { ok: true as const, value: members };
    }),
  } satisfies Pick<UsersApi, 'listUsers' | 'getUser' | 'listProjectMembers'>;
}
