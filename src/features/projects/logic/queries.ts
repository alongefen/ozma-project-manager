import 'server-only';
import { z } from 'zod';
import type { Platform, ProjectsApi, ProjectCard } from '@/types/contracts';
import { ProjectCardSchema, ProjectDetailsSchema, ProjectsApiInputSchemas as schemas } from '@/types/contracts/schemas';
import { failure, mapError } from '@/lib/db/rpc';
import { validated } from './validation';

type Queries = Pick<ProjectsApi, 'listProjects' | 'getProject'>;
export function createProjectQueries(platform: Platform): Queries {
  return {
    listProjects: validated(schemas.listProjects, async (ctx, input) => {
      // The SQL function aggregates all RLS-visible cards and counts into one JSON
      // value, so the Data API row limit does not truncate this list.
      const { search, ...filters } = input;
      const result = await platform.rpc<typeof filters, ProjectCard[]>(ctx, 'project_cards', filters);
      if (!result.ok) return result;
      const cards = z.array(ProjectCardSchema).safeParse(result.value);
      if (!cards.success) return failure('UNAVAILABLE');
      const key = platform.format.searchKey(search ?? '');
      return { ok: true, value: cards.data.filter(card => !key || platform.format.searchKey(`${card.name} ${card.businessName} ${card.siteAddress}`).includes(key)) };
    }),
    getProject: validated(schemas.getProject, async (ctx, { id }) => {
      const project = await ctx.db.from('projects').select('id,name,business_name,site_address,start_date,end_date,access_notes,status,archived_at,revision').eq('id', id).maybeSingle();
      if (project.error) return { ok: false, error: mapError(project.error) };
      if (!project.data) return failure('NOT_FOUND');
      const contact = await ctx.db.from('project_contacts').select('name,phone,email,role_title').eq('project_id', id).maybeSingle();
      if (contact.error) return { ok: false, error: mapError(contact.error) };
      if (!contact.data) return failure('NOT_FOUND');
      const cover = await ctx.db.from('project_covers').select('file_id').eq('project_id', id).eq('is_active', true).maybeSingle();
      if (cover.error) return { ok: false, error: mapError(cover.error) };
      const managers = await platform.rpc<{ projectId: string }, string[]>(ctx, 'project_manager_names', { projectId: id });
      if (!managers.ok) return managers;
      const permissions = await platform.permissions.forProject(ctx, { projectId: id });
      if (!permissions.ok) return permissions;
      let privateFields = {};
      if (ctx.actor.isOwner) {
        const secret = await ctx.db.from('project_private').select('business_number').eq('project_id', id).maybeSingle();
        if (secret.error) return { ok: false, error: mapError(secret.error) };
        if (secret.data) privateFields = { businessNumber: secret.data.business_number };
      }
      const p = project.data;
      const c = contact.data;
      const result = ProjectDetailsSchema.safeParse({
        id: p.id, name: p.name, businessName: p.business_name, siteAddress: p.site_address,
        startDate: p.start_date, endDate: p.end_date, accessNotes: p.access_notes,
        status: p.status, archived: p.archived_at !== null, revision: p.revision,
        contact: { name: c.name, phone: c.phone, email: c.email, roleTitle: c.role_title },
        coverFileId: cover.data?.file_id ?? null, managerNames: managers.value,
        permissions: permissions.value, ...privateFields,
      });
      return result.success ? { ok: true, value: result.data } : failure('UNAVAILABLE');
    }),
  } satisfies Queries;
}
