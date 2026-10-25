import type { Metadata } from 'next';
import {
  Instrument_Serif,
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

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
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
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${publicSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#172B4D]">
        {children}
      </body>
    </html>
  );
}
