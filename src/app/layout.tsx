import type { Metadata } from 'next';
import {
  Plus_Jakarta_Sans,
  Public_Sans,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
    'Web-based Local Government Unit Project Monitoring System for tracking public infrastructure, budgets, procurement, and civic project lifecycles.',
  openGraph: {
    title: 'LGU Tracker — Bantay Proyekto, Gabay sa Progreso',
    description:
      'Web-based Local Government Unit Project Monitoring System for tracking public infrastructure, budgets, procurement, and civic project lifecycles.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#172B4D]">
        {children}
      </body>
    </html>
  );
}
