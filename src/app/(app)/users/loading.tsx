import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare bar={[220, 140]} cards={3} />;
}
