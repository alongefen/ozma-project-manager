import type { DiaryRow } from '@/types/contracts';
import type { DiaryFilter, ProjectOption } from './model';

export type WorkDaysState = { status: 'ready'; count: number } | { status: 'loading' } | { status: 'error' };

/** Everything a diary list screen needs, already decided on the server. The views only lay it out. */
export type DiaryScreen = {
  rows: DiaryRow[];
  nextCursor: string | null;
  filter: DiaryFilter;
  /** Project picker for filter and print. Null when the screen is fixed to one project. */
  projects: ProjectOption[] | null;
  /** Set on the project tab: print and "new report" are about this project. */
  fixedProjectId?: string;
  /** Authoritative aggregate, present only in the fixed-project diary. */
  workDays?: WorkDaysState;
  canReport: boolean;
  /** Why the viewer cannot add reports (finished project), shown instead of the button. */
  readOnlyNote?: string;
  today: string;
  /** Where the filter form submits. */
  basePath: string;
  /** Projects the form offers (the live `report` permission), and whether the viewer is Ben (may move a report). */
  formProjects: ProjectOption[];
  isOwner: boolean;
};
