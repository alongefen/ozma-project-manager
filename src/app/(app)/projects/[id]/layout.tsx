import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Project context layout. It adds no chrome of its own: the project screens (P2.2+) open as
 * full screens on the phone (UX-19, no tab bar) and with internal navigation on desktop.
 * Access is decided by the database per project, not here; this only rejects malformed ids.
 */
export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <>{children}</>;
}
