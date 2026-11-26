import { PageSkeleton } from '@/components/ui';
// Static data placeholders only: no functional entry point before the server guard completes.
export default function Loading() { return <PageSkeleton bare cards={3} />; }
