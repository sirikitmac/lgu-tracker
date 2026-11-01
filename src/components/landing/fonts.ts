import { Anton } from 'next/font/google';

/**
 * The landing page's condensed display face, for its all-caps headlines and
 * figures only; body text stays in Public Sans. Self-hosted by next/font,
 * with condensed system faces as the fallback while it loads.
 */
export const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
  fallback: ['Impact', 'Arial Narrow', 'sans-serif'],
});
