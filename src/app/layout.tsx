import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './styles.css';

export const metadata: Metadata = {
  title: 'Proply',
  description: 'Every registered sale in E10, E11, and E17, enriched with original asking prices where available.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const saved = localStorage.getItem('proply-theme');
            const theme = saved === 'light' || saved === 'dark'
              ? saved
              : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.dataset.theme = theme;
          } catch (_) {}
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
