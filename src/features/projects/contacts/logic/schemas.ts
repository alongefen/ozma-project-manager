import { z } from 'zod';
import { UuidSchema } from '@/types/contracts/schemas';

const name = z.string().trim().min(1).max(120);
const phone = z.string().trim().min(1).max(40);
const roleTitle = z.string().trim().max(120).transform(v => (v === '' ? null : v)).nullable();

export const ContactInputSchemas = {
  listContacts: z.strictObject({ projectId: UuidSchema }),
  createContact: z.strictObject({ requestId: UuidSchema, projectId: UuidSchema, name, roleTitle, phone }),
  updateContact: z.strictObject({ id: UuidSchema, expectedRevision: z.number().int().positive(), name, roleTitle, phone }),
  removeContact: z.strictObject({ id: UuidSchema, expectedRevision: z.number().int().positive() }),
};

export type ContactRow = { id: string; name: string; roleTitle: string | null; phone: string; revision: number };
export type ContactsList = { contacts: ContactRow[]; canWrite: boolean };
