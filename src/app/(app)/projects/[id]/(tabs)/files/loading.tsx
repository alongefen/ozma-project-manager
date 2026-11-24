import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare bar={[150, 260, 160]} cards={3} />;
}
