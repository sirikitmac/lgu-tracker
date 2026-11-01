import type { Metadata } from 'next';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { categoryLabel } from '@/components/dpwh/format';
import { cardPhotoCredits, DATA_CREDITS, landingPhotoCredits } from '@/components/landing/credits';

export const metadata: Metadata = {
  title: 'Photo & data credits · LGU Tracker',
  description: 'Sources and licenses of the data and photographs used in LGU Tracker.',
};

const link = 'underline underline-offset-2 decoration-line-strong rounded-sm hover:text-accent-ink hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
const sectionTitle = 'text-[20px] font-semibold tracking-[-0.01em] text-ink';

function Ext({ href, children, label }: { href: string; children: React.ReactNode; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${link}`}>
      {children}
      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label ? ` ${label}` : ''} (opens in a new tab)</span>
    </a>
  );
}

interface PhotoRow {
  src: string;
  name: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

function PhotoList({ photos, label }: { photos: PhotoRow[]; label: string }) {
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2" aria-label={label}>
      {photos.map((p) => (
        <li key={p.src} className="flex items-start gap-3 min-w-0">
          <Image src={p.src} alt="" width={72} height={54} sizes="72px" className="w-[72px] h-[54px] shrink-0 rounded-md object-cover bg-sunken" />
          <div className="min-w-0 text-[13px] leading-snug text-subtle">
            <p className="font-medium text-ink break-words">{p.name}</p>
            <p className="mt-0.5">
              {p.creator} · <Ext href={p.licenseUrl} label="license">{p.license}</Ext> · <Ext href={p.sourceUrl} label={`for ${p.name}`}>Source</Ext>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CreditsPage() {
  const landing = landingPhotoCredits();
  const cards = cardPhotoCredits();

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
      <Navbar />
      <main className="site-frame flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        <header className="max-w-[60ch]">
          <h1 className="page-title text-[30px] sm:text-[36px] text-ink">Photo &amp; data credits</h1>
          <p className="mt-2 text-[15px] text-subtle">
            Where the data and pictures come from, and their licenses. Photos are illustrative scenes from Wikimedia Commons, not project records.
          </p>
        </header>

        <section aria-labelledby="credits-data" className="space-y-4">
          <h2 id="credits-data" className={sectionTitle}>Data</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {DATA_CREDITS.map((d) => (
              <li key={d.name} className="rounded-card bg-surface border border-line p-4 sm:p-5 text-[14px] leading-snug">
                <p className="font-semibold text-ink">{d.name}</p>
                <p className="mt-1 text-subtle">{d.what}</p>
                <p className="mt-2 text-[13px] text-subtle">
                  License: {d.licenseUrl ? <Ext href={d.licenseUrl} label="license">{d.license}</Ext> : d.license} · <Ext href={d.sourceUrl} label={`for ${d.name}`}>Source</Ext>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="credits-landing" className="space-y-4">
          <h2 id="credits-landing" className={sectionTitle}>Photos on the home page</h2>
          <PhotoList
            label="Home page photos"
            photos={landing.map((p) => ({ src: p.src, name: p.caption, creator: p.creator, license: p.license, licenseUrl: p.licenseUrl, sourceUrl: p.sourceUrl }))}
          />
        </section>

        <section aria-labelledby="credits-cards" className="space-y-6">
          <div>
            <h2 id="credits-cards" className={sectionTitle}>Photos on project cards</h2>
            <p className="mt-1 text-[14px] text-subtle">Representative of the kind of work, by category. Home page photos above may also appear on cards.</p>
          </div>
          {cards.map((g) => (
            <div key={g.category} className="space-y-3">
              <h3 className="text-[15px] font-semibold text-ink">{categoryLabel(g.category)}</h3>
              <PhotoList
                label={`${categoryLabel(g.category)} photos`}
                photos={g.photos.map((p) => ({ src: p.src, name: p.title, creator: p.creator, license: p.license, licenseUrl: p.licenseUrl, sourceUrl: p.sourceUrl }))}
              />
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
