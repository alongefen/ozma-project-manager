import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare bar={[150]} cards={3} />;
}
