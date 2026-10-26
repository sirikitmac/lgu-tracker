import type { Metadata } from 'next';
import { Public_Sans, JetBrains_Mono } from 'next/font/google';
import { themeInitScript } from '@/lib/theme';
import './globals.css';

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-public-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LGU Tracker — Bantay Proyekto, Gabay sa Progreso',
  description:
    'A public directory and map of DPWH infrastructure contracts in the Visayas and Mindanao: what was built, where, by whom, for how much, and how far along.',
  openGraph: {
    title: 'LGU Tracker — Bantay Proyekto, Gabay sa Progreso',
    description:
      'A public directory and map of DPWH infrastructure contracts in the Visayas and Mindanao: what was built, where, by whom, for how much, and how far along.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Rendered light; the inline script swaps in a saved theme before first
    // paint, so <html> may differ from the server markup on purpose.
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${publicSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen flex flex-col bg-ground text-ink">
        {children}
      </body>
    </html>
  );
}
