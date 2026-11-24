import { PageSkeleton } from '@/components/ui';

export default function Loading() {
  return <PageSkeleton bare heading="יומן עבודה" bar={[96, 230, 150]} cards={3} />;
}
