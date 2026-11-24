import { InnerPageSkeleton } from '@/components/ui';

export default function Loading() {
  return <InnerPageSkeleton title="הדפסה וייצוא יומן לפי תאריך" backHref="/diary" backLabel="חזרה ליומן" cards={1} />;
}
