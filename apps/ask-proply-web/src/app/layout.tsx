import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Ask Proply — governed property research',
  description: 'Bounded, read-only property research for E10, E11 and E17.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
