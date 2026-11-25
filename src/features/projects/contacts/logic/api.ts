import type { Operation, Saved } from '@/types/contracts';
import type { ContactInputSchemas, ContactsList } from './schemas';
import type { z } from 'zod';

type In<K extends keyof typeof ContactInputSchemas> = z.infer<(typeof ContactInputSchemas)[K]>;
export interface ContactsApi {
  listContacts: Operation<In<'listContacts'>, ContactsList>;
  createContact: Operation<In<'createContact'>, Saved>;
  updateContact: Operation<In<'updateContact'>, Saved>;
  removeContact: Operation<In<'removeContact'>, Saved>;
}
