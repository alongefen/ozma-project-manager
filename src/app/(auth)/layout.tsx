import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import '@/styles/app.css';

export const metadata: Metadata = { title: { default: 'חי עוצמה בבנייה', template: '%s | חי עוצמה' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#33abe3' };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
