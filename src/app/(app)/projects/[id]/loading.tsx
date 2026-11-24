import { PageSkeleton } from '@/components/ui';

/** Entering a project: the real back link at once, placeholders only for the name and tabs, then the content skeleton. */
export default function Loading() {
  return <PageSkeleton frame cards={3} />;
}
