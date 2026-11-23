import type { MetadataRoute } from 'next';

// UX-15: installable as a PWA (home screen, standalone). Not offline, not a store app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'חי עוצמה בבנייה',
    short_name: 'חי עוצמה',
    description: 'ניהול פרויקטים, יומן עבודה ומסמכים',
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f6f8',
    theme_color: '#33abe3',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
