import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare bar={[170, 140, 150]} cards={2} />;
}
