import { InnerPageSkeleton } from '@/components/ui';

export default function Loading() {
  return <InnerPageSkeleton title="הרשאות" backHref="/projects/[id]" backLabel="חזרה לתיק הפרויקט" subLoading />;
}
