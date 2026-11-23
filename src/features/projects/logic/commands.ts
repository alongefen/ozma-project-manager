import 'server-only';
import type { Platform, ProjectsApi, Saved } from '@/types/contracts';
import { ProjectsApiInputSchemas as schemas } from '@/types/contracts/schemas';
import { validated } from './validation';

type Commands = Pick<ProjectsApi, 'createProject' | 'updateProject' | 'setProjectStatus' | 'setProjectArchived' | 'setProjectCover'>;

export function createProjectCommands(platform: Platform): Commands {
  // The existing RPCs check live ownership/membership, read-only state, revision,
  // and cover file ownership/project atomically. Never pre-read a retry receipt.
  return {
    createProject: validated(schemas.createProject, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'create_project', input)),
    updateProject: validated(schemas.updateProject, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'update_project', input)),
    setProjectStatus: validated(schemas.setProjectStatus, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'set_project_status', input)),
    setProjectArchived: validated(schemas.setProjectArchived, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'set_project_archived', input)),
    setProjectCover: validated(schemas.setProjectCover, (ctx, input) => platform.rpc<typeof input, Saved>(ctx, 'set_project_cover', input)),
  } satisfies Commands;
}
