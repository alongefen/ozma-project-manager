import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare title="כספים" bar={[170, 140, 150]} cards={2} />;
}
