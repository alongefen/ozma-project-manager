'use client';
import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui';

/** Entry and filter windows of the finance screens: the shared sheet (bottom sheet on the phone, centred window on desktop). */
export function EntrySheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Sheet open onClose={onClose} title={title}>{children}</Sheet>;
}
