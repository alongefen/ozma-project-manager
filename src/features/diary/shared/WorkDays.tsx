'use client';
import { Notice, Skeleton } from '@/components/ui';
import { useDiary } from './DiaryProvider';

/** Project-only server aggregate. Kept outside Pin so the action row stays compact. */
export function WorkDays() {
  const { workDays } = useDiary();
  if (!workDays) return null;
  return (
    <div className="dr-work-days no-print" role="status" aria-live="polite" aria-busy={workDays.status === 'loading'}>
      {workDays.status === 'error'
        ? <Notice tone="error">מספר ימי העבודה אינו זמין כרגע</Notice>
        : workDays.status === 'loading'
          ? <><span>ימי עבודה שדווחו: </span><Skeleton width={32} height={20} /></>
          : <span>ימי עבודה שדווחו: {workDays.count}</span>}
    </div>
  );
}
