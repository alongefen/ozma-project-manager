'use client';
import { Button, Notice } from '@/components/ui';

/** Shared body of every route-level error.tsx: one plain message and a retry. Never shows the error text. */
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <div className="ui-page ui-page--narrow">
      <Notice tone="error">משהו השתבש בטעינת המסך. נסו שוב.</Notice>
      <Button onClick={reset}>ניסיון חוזר</Button>
    </div>
  );
}
