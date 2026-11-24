import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare heading="משימות" bar={[150]} cards={3} />;
}
