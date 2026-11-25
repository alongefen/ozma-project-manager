import 'server-only';
import type { Platform, Saved } from '@/types/contracts';
import { failure, mapError } from '@/lib/db/rpc';
import { untypedDb } from '../../logic/untyped-db';
import { validated } from '../../logic/validation';
import { ContactInputSchemas as s } from './schemas';
import type { ContactRow } from './schemas';
import type { ContactsApi } from './api';

type Row = { id: string; name: string; role_title: string | null; phone: string; revision: number };

/** Extra contacts of a project (CLIENT-FEEDBACK-B). Everyone on the project reads; managers and owner-level accounts write (database decides). */
export function createContactsApi(platform: Pick<Platform, 'rpc' | 'permissions'>): ContactsApi {
  return {
    listContacts: validated(s.listContacts, async (ctx, { projectId }) => {
      const permission = await platform.permissions.forProject(ctx, { projectId });
      if (!permission.ok) return permission;
      if (!permission.value.view) return failure('NOT_FOUND');
      const { data, error } = await untypedDb(ctx).from('project_extra_contacts')
        .select('id,name,role_title,phone,revision').eq('project_id', projectId).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(200);
      if (error) return { ok: false, error: mapError(error) };
      const contacts: ContactRow[] = ((data ?? []) as Row[]).map(r => ({ id: r.id, name: r.name, roleTitle: r.role_title, phone: r.phone, revision: r.revision }));
      return { ok: true, value: { contacts, canWrite: permission.value.editDetails } };
    }),
    createContact: validated(s.createContact, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'create_project_contact', input)),
    updateContact: validated(s.updateContact, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'update_project_contact', input)),
    removeContact: validated(s.removeContact, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'remove_project_contact', input)),
  };
}
