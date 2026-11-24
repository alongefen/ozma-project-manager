import type { ReactNode } from 'react';

/**
 * Desktop page title row of a top-level screen (`/projects`, `/finance`, `/diary`, `/users`): the same size and place
 * as the inner-page header (`ui-ph`), title on the right, actions at the far left. The phone shell header already
 * shows the title, so this is desktop only. Inside a project the tab itself is the title: no title row.
 */
export function DesktopTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ui-ph d-only">
      <div className="ui-ph__row">
        <h1 className="ui-ph__title">{title}</h1>
        {children && <div className="ui-ph__actions">{children}</div>}
      </div>
    </div>
  );
}
