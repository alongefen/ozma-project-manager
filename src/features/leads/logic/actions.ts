'use server';
import type { LeadsApi } from '@/types/contracts/leads';
import type { Result } from '@/types/contracts';
import { failure } from '@/lib/db/rpc';

// Deliberately closed during DATA dispatch. Integration must replace this body with the
// ISOLATION server guard, server context and createLeadsApi before exposing UI/Preview.
async function closed<T>(input: unknown): Promise<Result<T>> { void input; return failure('NOT_FOUND'); }
export async function listLeads(_input: Parameters<LeadsApi['listLeads']>[1]): ReturnType<LeadsApi['listLeads']> { return closed(_input); }
export async function getLead(_input: Parameters<LeadsApi['getLead']>[1]): ReturnType<LeadsApi['getLead']> { return closed(_input); }
export async function createLead(_input: Parameters<LeadsApi['createLead']>[1]): ReturnType<LeadsApi['createLead']> { return closed(_input); }
export async function updateLead(_input: Parameters<LeadsApi['updateLead']>[1]): ReturnType<LeadsApi['updateLead']> { return closed(_input); }
export async function setLeadStatus(_input: Parameters<LeadsApi['setLeadStatus']>[1]): ReturnType<LeadsApi['setLeadStatus']> { return closed(_input); }
export async function setLeadArchived(_input: Parameters<LeadsApi['setLeadArchived']>[1]): ReturnType<LeadsApi['setLeadArchived']> { return closed(_input); }
export async function deleteLead(_input: Parameters<LeadsApi['deleteLead']>[1]): ReturnType<LeadsApi['deleteLead']> { return closed(_input); }
