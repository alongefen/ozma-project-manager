import { Badge, Card } from '@/components/ui';
import type { UserRow } from '@/types/contracts';
import { assignmentLabel, statusLabel } from '../shared/view-model';
import css from './UsersMobile.module.css';

/** Phone list: one card per person with their projects and role in each. Whole card opens the person. */
export function UsersMobile({ users, onOpen }: { users: UserRow[]; onOpen: (id: string) => void }) {
  return (
    <ul className={css.list}>
      {users.map(u => (
        <li key={u.id}>
          <Card className={css.card}>
            <button type="button" className={css.open} onClick={() => onOpen(u.id)}>
              <span className={css.head}>
                <strong className={css.name}>{u.fullName}</strong>
                <Badge tone={u.isActive ? 'active' : 'gray'}>{statusLabel(u)}</Badge>
              </span>
              <span className={`${css.email} ltr`} dir="ltr">{u.email}</span>
              {u.assignments.length === 0
                ? <span className={css.none}>{u.isOwner ? 'רואה את כל הפרויקטים' : 'לא משויך לפרויקט'}</span>
                : <span className={css.projects}>{u.assignments.map(a => <span key={a.projectId} className={css.chip}>{assignmentLabel(a)}</span>)}</span>}
            </button>
          </Card>
        </li>
      ))}
    </ul>
  );
}
