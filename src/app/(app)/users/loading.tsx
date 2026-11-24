import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare title="עובדים והרשאות" bar={[120, 240, 170, 170, 170]} cards={3} />;
}
