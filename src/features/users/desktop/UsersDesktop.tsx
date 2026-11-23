import { Badge, Button, Card } from '@/components/ui';
import type { UserRow } from '@/types/contracts';
import { assignmentLabel, statusLabel } from '../shared/view-model';
import css from './UsersDesktop.module.css';

/** Wide table: person, status and every project assignment in one row, so access can be scanned and managed at a glance. */
export function UsersDesktop({ users, onOpen }: { users: UserRow[]; onOpen: (id: string) => void }) {
  return (
    <Card panel className={css.card}>
      <table className={css.table}>
        <thead>
          <tr><th scope="col">שם</th><th scope="col">אימייל</th><th scope="col">סטטוס</th><th scope="col">פרויקטים ותפקיד</th><th scope="col"><span className="sr-only">פעולות</span></th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <th scope="row" className={css.name}>{u.fullName}</th>
              <td className={css.email} dir="ltr">{u.email}</td>
              <td><Badge tone={u.isActive ? 'active' : 'gray'}>{statusLabel(u)}</Badge></td>
              <td>
                {u.assignments.length === 0
                  ? <span className={css.none}>{u.isOwner ? 'רואה את כל הפרויקטים' : 'לא משויך לפרויקט'}</span>
                  : <span className={css.projects}>{u.assignments.map(a => <span key={a.projectId} className={css.chip}>{assignmentLabel(a)}{a.role === 'manager' && a.financeAccess ? ' · כספים' : ''}</span>)}</span>}
              </td>
              <td className={css.actions}><Button variant="secondary" size="small" onClick={() => onOpen(u.id)}>{u.isOwner ? 'פרטים' : 'ניהול גישה'}</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
