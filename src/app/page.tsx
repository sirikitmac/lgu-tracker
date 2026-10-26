import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Map as MapIcon, Search } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CoverageExplorer } from '@/components/landing/CoverageExplorer';
import { Reveal } from '@/components/landing/Reveal';
import { PHOTOS, regionName, type LandingPhoto } from '@/components/landing/content';
import {
  categoryLabel,
  contractMapHref,
  formatCount,
  formatDate,
  formatPeso,
  formatPesoCompact,
  formatProgress,
  statusLabel,
} from '@/components/dpwh/format';
import { LGU_STATUS_TONE, STATUS_TONES } from '@/lib/statusPalette';
import { regionColor } from '@/lib/regionPalette';
import { loadLandingData, POINTS_PER_REGION, type ExampleContract, type LandingData } from '@/lib/landing/data';

/** Figures come from the database; refresh the prerendered page at most hourly. */
export const revalidate = 3600;

/** One pair of outer margins for every section, aligned with the navigation bar. */
const FRAME = 'mx-auto w-full max-w-7xl px-4 sm:px-6';

/*
 * The landing page wears the work-zone colours of DPWH site signs: signal
 * orange, blue-black night, peach and rust. They are fixed brand fields in
 * both themes, so text on them uses fixed inks (night, white, rust-ink), and
 * focus rings switch to whichever of night or signal stands out on the field.
 */
const FOCUS_ON_LIGHT = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-night';
const FOCUS_ON_DARK = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal';

const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export default async function LandingPage() {
  const data = await loadLandingData();

  return (
    <div className="landing min-h-svh flex flex-col bg-ground">
      <Navbar />
      <Reveal />

      <main className="flex-1">
        <Hero data={data} />
        <Destinations data={data} />
        <WhyNow data={data} />
        <Coverage data={data} />
        <HowItWorks example={data.example} regionPoints={data.regions.find((r) => r.region === 'Region X')?.points ?? []} />
        <Audiences />
        <About />
        <ExploreBand totalContracts={data.totalContracts} />
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** A photograph's caption laid over it: what and where, and that it is not a project record. */
function PhotoLabel({ photo, className = '' }: { photo: LandingPhoto; className?: string }) {
  return (
    <figcaption className={`glass-chip inline-flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium leading-tight ${className}`}>
      <span className="truncate">{photo.caption}</span>
      <span className="shrink-0 text-white/75">· Illustrative</span>
    </figcaption>
  );
}

function Hero({ data }: { data: LandingData }) {
  const photo = PHOTOS.sanJuanico;
  return (
    <section className="bg-signal text-night pt-12 pb-14 sm:pt-16 lg:pt-20 lg:pb-20" aria-labelledby="hero-title">
      <div className={`${FRAME} grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 items-center`}>
        <div className="lg:col-span-7">
          <h1 id="hero-title" className="font-display text-[length:var(--step-display)] leading-[0.92]">
            Bantay
            <br />
            Proyekto.
          </h1>
          <p className="mt-6 text-[length:var(--step-lead)] leading-snug max-w-[34ch]">
            LGU Tracker is a public directory and map of DPWH contracts in the Visayas and Mindanao: what was built, where, by whom and for how much.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link
              href="/projects"
              className={`inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-full bg-night text-white font-semibold text-[15px] transition-[background-color,color,transform] duration-150 hover:bg-white hover:text-night active:scale-[0.98] ${FOCUS_ON_LIGHT}`}
            >
              Explore projects
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/projects/map"
              className={`inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-full border-2 border-night text-night font-semibold text-[15px] transition-[background-color,color,transform] duration-150 hover:bg-night hover:text-signal active:scale-[0.98] ${FOCUS_ON_LIGHT}`}
            >
              <MapIcon className="w-4 h-4" aria-hidden="true" />
              Open the project map
            </Link>
          </div>

          <p className="mt-6 text-[length:var(--step-small)] max-w-[52ch]">
            {data.totalContracts !== null
              ? `${formatCount(data.totalContracts)} contracts from ten regions of the Visayas and Mindanao`
              : 'Contracts from ten regions of the Visayas and Mindanao'}
            {data.nepProposals !== null ? `, plus ${formatCount(data.nepProposals)} proposed projects nationwide.` : '.'}
          </p>
        </div>

        {/* The arch from the original landing page, after the shape of a bridge span. */}
        <figure className="lg:col-span-5 relative mx-auto w-full max-w-[30rem]">
          <div className="relative aspect-[4/3] lg:aspect-[4/5] overflow-hidden rounded-[28px] lg:rounded-b-[28px] lg:rounded-t-full bg-rust">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              preload
              sizes="(min-width: 1024px) 34vw, 100vw"
              className="object-cover object-[62%_50%]"
            />
          </div>
          <PhotoLabel photo={photo} className="absolute left-4 bottom-4" />
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Six destinations, each an existing page or section. "Communities" opens the
 * regional coverage explorer: the product has no community chapters feature,
 * so the card points at the place-based view that does exist.
 */
function Destinations({ data }: { data: LandingData }) {
  const ranked = data.regions
    .filter((r): r is typeof r & { contracts: number } => r.contracts !== null && r.contracts > 0)
    .sort((a, b) => b.contracts - a.contracts);
  const top = ranked.slice(0, 4);
  const topMax = Math.max(1, ...top.map((r) => r.contracts));
  const hasPoints = data.regions.some((r) => r.points.length > 0);

  return (
    <section id="explore" className="bg-night text-white pt-14 pb-16 lg:pt-20 lg:pb-24 scroll-mt-20" aria-labelledby="explore-title">
      <div className={FRAME}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <h2 id="explore-title" className="font-display text-[length:var(--step-head)] leading-tight">
            Start exploring
          </h2>
          <p className="text-[15px] text-white/75 max-w-[44ch] sm:text-right">
            Every card opens a part of LGU Tracker that works today.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 lg:auto-rows-[minmax(20rem,auto)]">
          <li data-reveal>
            <BentoCard
              href="/projects/map"
              field="bg-peach text-night"
              soft="text-night/80"
              title="Map"
              text="Every mapped contract by location, coloured by status or region."
              visual={
                hasPoints ? (
                  <svg viewBox="0 0 760 830" className="mx-auto h-full w-auto max-w-full" role="img" aria-label="Contract locations across the Visayas and Mindanao, coloured by region">
                    {data.regions.map((r) => (
                      <g key={r.region} fill={regionColor(r.region)}>
                        {r.points.map(([lon, lat], i) => (
                          <circle key={i} cx={((lon - 119.3) * 100).toFixed(0)} cy={((12.7 - lat) * 100).toFixed(0)} r="6" />
                        ))}
                      </g>
                    ))}
                  </svg>
                ) : (
                  <MapIcon className="mx-auto w-14 h-14 text-night/40" aria-hidden="true" />
                )
              }
            />
          </li>

          <li data-reveal style={delay(60)}>
            <BentoCard
              href="/projects?view=grid"
              title="Projects"
              text={
                data.totalContracts !== null
                  ? `Search ${formatCount(data.totalContracts)} contracts by place, contractor, category or status.`
                  : 'Search the contracts by place, contractor, category or status.'
              }
              photo={PHOTOS.marceloFernan}
            />
          </li>

          <li data-reveal style={delay(120)}>
            <BentoCard
              href="/#coverage"
              title="Communities"
              text="Find the records for your region and province, from Western Visayas to BARMM."
              photo={PHOTOS.iligan}
            />
          </li>

          <li data-reveal>
            <BentoCard
              href="/dashboard"
              field="bg-surface text-ink"
              soft="text-subtle"
              title="Monitoring"
              text="The LGU's own workspace for tracking local projects from plan to turnover."
              visual={
                <ul className="flex flex-wrap gap-1.5" aria-label="Stages the workspace tracks">
                  {(['Planned', 'Procurement', 'In Progress', 'Completed'] as const).map((s) => (
                    <li key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 py-1 text-[13px] font-medium text-subtle">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_TONES[LGU_STATUS_TONE[s]].fill }} aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              }
            />
          </li>

          <li data-reveal style={delay(60)}>
            <BentoCard
              href="/projects/dashboard"
              field="bg-signal text-night"
              soft="text-night/80"
              title="Reporting"
              text="Totals by region, status, category and year, computed from the stored records."
              visual={
                top.length > 0 ? (
                  <dl className="w-full space-y-2" aria-label="Regions with the most stored contracts">
                    {top.map((r) => (
                      <div key={r.region}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <dt className="flex items-center gap-1.5 truncate">
                            <span className="h-2 w-2 shrink-0 rounded-[2px] ring-1 ring-night/20" style={{ backgroundColor: regionColor(r.region) }} aria-hidden="true" />
                            {regionName(r.region)}
                          </dt>
                          <dd className="font-semibold tabular-nums">{formatCount(r.contracts)}</dd>
                        </div>
                        <span className="mt-1 block h-1.5 rounded-full bg-night/15" aria-hidden="true">
                          <span className="block h-full rounded-full bg-night" style={{ width: `${(r.contracts / topMax) * 100}%` }} />
                        </span>
                      </div>
                    ))}
                  </dl>
                ) : null
              }
            />
          </li>

          <li data-reveal style={delay(120)}>
            <BentoCard
              href="/#about"
              field="bg-rust text-rust-ink"
              soft="text-rust-ink/80"
              title="About"
              text="Where the records come from, and what they can and cannot tell you."
              visual={
                <ul className="space-y-1.5 text-[13px] text-rust-ink/85">
                  <li>DPWH Transparency Portal contracts</li>
                  <li>FY 2027 National Expenditure Program</li>
                  <li>Published by BetterGov.ph</li>
                </ul>
              }
            />
          </li>
        </ul>
      </div>
    </section>
  );
}

function BentoCard({
  href,
  title,
  text,
  field,
  soft,
  visual,
  photo,
}: {
  href: string;
  title: string;
  text: string;
  /** Background and text classes of the card's colour field. */
  field?: string;
  /** Secondary text class that reads on that field. */
  soft?: string;
  visual?: React.ReactNode;
  photo?: LandingPhoto;
}) {
  const shell = `bento-card group relative flex h-full min-h-[17rem] lg:min-h-[20rem] flex-col overflow-hidden rounded-[24px] ${FOCUS_ON_DARK}`;
  const arrow = (onPhoto: boolean) => (
    <span
      className={`bento-arrow absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full ${
        onPhoto ? 'glass-chip' : 'bg-night/10 group-hover:bg-night group-hover:text-signal'
      }`}
      aria-hidden="true"
    >
      <ArrowUpRight className="w-4 h-4" />
    </span>
  );

  if (photo) {
    return (
      <Link href={href} className={`${shell} bg-night text-white`}>
        <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw" className="bento-media object-cover" />
        <span className="photo-scrim absolute inset-0" aria-hidden="true" />
        <span className="glass-chip absolute top-4 left-4 rounded-full px-2.5 py-1 text-[13px] font-medium">Illustrative photo</span>
        {arrow(true)}
        <span className="relative mt-auto p-6">
          <span className="block text-[22px] font-semibold tracking-[-0.02em]">{title}</span>
          <span className="mt-1.5 block text-[15px] leading-snug text-white/88 max-w-[34ch]">{text}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className={`${shell} ${field}`}>
      {arrow(false)}
      <span className="block p-6 pr-16">
        <span className="block text-[22px] font-semibold tracking-[-0.02em]">{title}</span>
        <span className={`mt-1.5 block text-[15px] leading-snug max-w-[34ch] ${soft}`}>{text}</span>
      </span>
      {visual && <span className="mt-auto flex min-h-0 flex-1 items-end px-6 pb-6 max-h-56">{visual}</span>}
    </Link>
  );
}

/* ------------------------------------------------------------------------- */

function WhyNow({ data }: { data: LandingData }) {
  const photo = PHOTOS.route9;
  const figures = [
    data.totalAmount !== null && {
      value: formatPesoCompact(data.totalAmount),
      label: 'in contract amounts, as published',
    },
    data.totalContracts !== null && {
      value: formatCount(data.totalContracts),
      label: 'contracts anyone can search without signing in',
    },
    data.ongoingContracts !== null && {
      value: formatCount(data.ongoingContracts),
      label: 'reported as still ongoing',
    },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <section id="why" className="py-16 lg:py-24 scroll-mt-20" aria-labelledby="why-title">
      <div className={`${FRAME} grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 items-center`}>
        <div className="lg:col-span-6">
          <h2 id="why-title" data-reveal className="font-display text-[length:var(--step-head)] leading-tight">
            Why it matters now
          </h2>
          <p data-reveal style={delay(60)} className="mt-5 text-[length:var(--step-lead)] leading-snug max-w-[36ch]">
            Roads, bridges and flood defences are paid for with public money, yet the record behind a work site is hard to find.
          </p>
          <p data-reveal style={delay(120)} className="mt-4 text-subtle max-w-[58ch]">
            DPWH publishes contracts, and the budget proposes new projects every year, but the records are spread across
            portals, spreadsheets and PDFs. Recent scrutiny of flood-control and road spending has made the question
            practical: what was contracted near me, who is building it, and is it finished?
          </p>

          {figures.length > 0 && (
            <dl className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {figures.map((f, i) => (
                <div
                  key={f.label}
                  data-reveal
                  style={delay(180 + i * 60)}
                  className={`flex flex-col-reverse rounded-2xl px-5 py-4 ${i === 0 ? 'bg-signal text-night' : 'bg-sunken text-ink'}`}
                >
                  <dt className={`mt-1 text-[13px] leading-snug ${i === 0 ? 'text-night/80' : 'text-muted'}`}>{f.label}</dt>
                  <dd className="font-display text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] leading-none tracking-[-0.03em] tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-[13px] text-muted max-w-[60ch]">
            Figures are totals of the records as published by DPWH via BetterGov.ph; they have not been independently verified by the LGU.
          </p>
        </div>

        <figure data-reveal style={delay(100)} className="lg:col-span-6 relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-stone">
            <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 46vw, 100vw" className="object-cover object-[52%_60%]" />
          </div>
          <PhotoLabel photo={photo} className="absolute left-4 bottom-4" />
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function Coverage({ data }: { data: LandingData }) {
  return (
    <section id="coverage" className="bg-signal text-night py-16 lg:py-24 scroll-mt-20" aria-labelledby="coverage-title">
      <div className={FRAME}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-4">
          <h2 id="coverage-title" data-reveal className="lg:col-span-5 font-display text-[length:var(--step-head)] leading-tight">
            Where the records are
          </h2>
          <div data-reveal style={delay(60)} className="lg:col-span-7 space-y-3 max-w-[60ch]">
            <p className="text-[length:var(--step-lead)] leading-snug">
              Ten regions of the Visayas and Mindanao, including Northern Mindanao, home to Iligan City.
            </p>
            <p>
              Contracts come from the DPWH Transparency Portal snapshot published by BetterGov.ph. LGU Tracker stores
              contracts located in these regions; Luzon and Metro Manila are not included. The import is not finished
              yet, so the counts are the records stored so far.
            </p>
          </div>
        </div>

        <div data-reveal style={delay(120)} className="mt-10">
          <CoverageExplorer regions={data.regions} totalContracts={data.totalContracts} pointsPerRegion={POINTS_PER_REGION} />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-3 text-[15px]">
          <p className="lg:col-span-8 max-w-[64ch]">
            Also in the directory, nationwide:{' '}
            {data.nepProposals !== null ? `${formatCount(data.nepProposals)} DPWH projects` : 'DPWH projects'} proposed in the
            FY 2027 National Expenditure Program. They are budget proposals, not contracts, and carry no coordinates, so they
            appear in the list but not on the map.{' '}
            <Link
              href="/projects?source=dpwh_nep_2027"
              className={`font-semibold underline decoration-2 underline-offset-4 rounded-sm hover:bg-night hover:text-signal transition-colors ${FOCUS_ON_LIGHT}`}
            >
              Browse the proposals
            </Link>
          </p>
          {data.computedAt && (
            <p className="lg:col-span-4 lg:text-right text-[13px] text-night/80">Figures as of {formatDate(data.computedAt)}.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const STEPS = [
  { clause: 'Search a place, project or contractor.', field: 'bg-stone text-ink', badge: 'bg-ink text-on-ink' },
  { clause: 'Find where it is on the map.', field: 'bg-peach text-night', badge: 'bg-night text-white' },
  { clause: 'Open the record: amount, contractor, progress.', field: 'bg-signal text-night', badge: 'bg-night text-white' },
  { clause: 'Follow it back to the published source.', field: 'bg-night text-white', badge: 'bg-signal text-night' },
] as const;

function HowItWorks({ example, regionPoints }: { example: ExampleContract | null; regionPoints: [number, number][] }) {
  return (
    <section id="how-it-works" className="scroll-mt-20" aria-labelledby="how-title">
      <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.clause} className={`${step.field} flex flex-col px-5 sm:px-8 lg:px-10 py-12 lg:py-16`}>
            {i === 0 ? (
              <h2 id="how-title" className="font-display text-[length:var(--step-head)] leading-tight">
                How it works
              </h2>
            ) : (
              <div className="hidden xl:block h-[calc(var(--step-head)*1.25)]" aria-hidden="true" />
            )}
            <div className="mt-8 flex items-start gap-3">
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${step.badge}`} aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="text-[19px] font-semibold leading-snug tracking-[-0.01em] max-w-[22ch]">{step.clause}</h3>
            </div>
            <div data-reveal style={delay(i * 70)} className="mt-6 w-full max-w-[20rem]">
              <StepCard step={i} example={example} regionPoints={regionPoints} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The same real contract, one step further along in each card. */
function StepCard({ step, example, regionPoints }: { step: number; example: ExampleContract | null; regionPoints: [number, number][] }) {
  const base = 'rounded-2xl bg-white text-night p-4 text-[14px] leading-snug shadow-raise';
  const title = example?.title ?? 'Contract title';
  const place = example ? [example.province, example.region && regionName(example.region)].filter(Boolean).join(' · ') : 'Province · Region';

  if (step === 0) {
    return (
      <div data-ui className={base}>
        <div className="flex items-center gap-2 rounded-full border-2 border-night px-3 py-2">
          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>linamon bridge</span>
        </div>
        <p className="mt-4 font-semibold line-clamp-3">{title}</p>
        <p className="mt-1 text-night/70">{place}</p>
      </div>
    );
  }

  if (step === 1) {
    const lon = example?.longitude ?? null;
    const lat = example?.latitude ?? null;
    // Region X frame, roughly 123.4–125.4 E, 7.2–9.3 N.
    const x = (v: number) => ((v - 123.4) / 2) * 260;
    const y = (v: number) => ((9.3 - v) / 2.1) * 200;
    const mapHref = example ? contractMapHref(example) : null;
    return (
      <div data-ui className={base}>
        <svg viewBox="0 0 260 200" className="w-full h-auto rounded-xl bg-[#EDEDEB]" role="img" aria-label="Contract location among other Northern Mindanao contracts">
          {regionPoints.map(([plon, plat], i) => (
            <circle key={i} cx={x(plon).toFixed(1)} cy={y(plat).toFixed(1)} r="2.6" fill="#050f16" opacity="0.35" />
          ))}
          {lon !== null && lat !== null && (
            <>
              <circle cx={x(lon)} cy={y(lat)} r="11" fill="#ff7a1f" opacity="0.45" />
              <circle cx={x(lon)} cy={y(lat)} r="5.5" fill="#ff7a1f" stroke="#050f16" strokeWidth="2" />
            </>
          )}
        </svg>
        <p className="mt-4 font-semibold">{place}</p>
        {lat !== null && lon !== null && (
          <p className="mt-1 tabular-nums text-night/70">
            {lat.toFixed(4)}° N, {lon.toFixed(4)}° E
          </p>
        )}
        {mapHref && (
          <Link href={mapHref} className={`mt-3 inline-block font-semibold underline underline-offset-4 rounded-sm hover:text-[#B45309] ${FOCUS_ON_LIGHT}`}>
            See it on the map
          </Link>
        )}
      </div>
    );
  }

  if (step === 2) {
    const progress = example?.progress ?? null;
    return (
      <div data-ui className={base}>
        <p className="font-semibold line-clamp-2">{title}</p>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-night/70">Contract amount</dt>
            <dd className="text-[22px] font-semibold tracking-[-0.02em] leading-tight tabular-nums">{formatPeso(example?.contract_amount)}</dd>
          </div>
          <div>
            <dt className="text-night/70">Contractor</dt>
            <dd className="font-semibold line-clamp-2">{example?.contractor ?? 'Not reported'}</dd>
          </div>
          <div>
            <dt className="text-night/70">{example ? `${statusLabel(example.status)} · ${categoryLabel(example.category)}` : 'Status'}</dt>
            <dd className="mt-1.5">
              <span className="block h-2 rounded-full bg-[#EDEDEB]">
                <span className="block h-full rounded-full bg-signal" style={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }} />
              </span>
              <span className="mt-1 block tabular-nums text-night/70">
                {formatProgress(progress)} complete · started {formatDate(example?.start_date)}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div data-ui className={base}>
      <dl className="space-y-3">
        <div>
          <dt className="text-night/70">Contract ID</dt>
          <dd className="font-semibold tabular-nums">{example?.contract_id ?? 'Not available'}</dd>
        </div>
        <div>
          <dt className="text-night/70">Implementing office</dt>
          <dd className="font-semibold">{example?.implementing_office ?? 'Not reported'}</dd>
        </div>
        <div>
          <dt className="text-night/70">Source</dt>
          <dd className="font-semibold">DPWH Transparency Portal, via BetterGov.ph (CC0)</dd>
        </div>
      </dl>
      <p className="mt-4 text-night/70">Shown as published; not verified by the LGU.</p>
      {example && (
        <Link
          href={`/projects/${encodeURIComponent(example.contract_id)}`}
          className={`mt-4 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-night text-white font-semibold transition-colors hover:bg-signal hover:text-night ${FOCUS_ON_LIGHT}`}
        >
          Open this record <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

const AUDIENCES: { name: string; text: string; photo: LandingPhoto; field: string; soft: string }[] = [
  {
    name: 'Citizens',
    text: 'Look up what is being built in your town or province, who the contractor is, and how far the work has gone.',
    photo: PHOTOS.iligan,
    field: 'bg-signal text-night',
    soft: 'text-night/85',
  },
  {
    name: 'Students',
    text: 'Use real public-works records for papers, capstone projects and data exercises: searchable, sourced and free to read.',
    photo: PHOTOS.wmsu,
    field: 'bg-surface text-ink',
    soft: 'text-subtle',
  },
  {
    name: 'Researchers',
    text: 'Compare regions, categories and contract amounts across tens of thousands of records, each linked to its source.',
    photo: PHOTOS.rizalMap,
    field: 'bg-peach text-night',
    soft: 'text-night/85',
  },
  {
    name: 'Civic groups',
    text: 'Bring project details to barangay assemblies, community monitoring and dialogues with local offices.',
    photo: PHOTOS.sanJuanico,
    field: 'bg-rust text-rust-ink',
    soft: 'text-rust-ink/85',
  },
];

function Audiences() {
  return (
    <section id="impact" className="bg-night text-white py-16 lg:py-24 scroll-mt-20" aria-labelledby="impact-title">
      <div className={FRAME}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <h2 id="impact-title" className="font-display text-[length:var(--step-head)] leading-tight">
            Who it is for
          </h2>
          <p className="text-[15px] text-white/75 max-w-[44ch] sm:text-right">
            Anyone with a question about a public work, and no time to file a records request.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {AUDIENCES.map((a, i) => (
            <li key={a.name} data-reveal style={delay(i * 70)} className={`overflow-hidden rounded-[24px] p-3 ${a.field}`}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-[16px] bg-stone">
                <Image src={a.photo.src} alt={a.photo.alt} fill sizes="(min-width: 1280px) 300px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <div className="px-2 pt-4 pb-3">
                <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{a.name}</h3>
                <p className={`mt-1.5 text-[15px] leading-snug ${a.soft}`}>{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const GOALS = [
  {
    name: 'SDG 9 · Industry, innovation and infrastructure',
    text: 'Resilient infrastructure starts with knowing what exists and where.',
  },
  {
    name: 'SDG 11 · Sustainable cities and communities',
    text: 'Residents and planners can see which projects touch their town or province.',
  },
  {
    name: 'SDG 16 · Peace, justice and strong institutions',
    text: 'Targets 16.6 and 16.10 call for accountable institutions and public access to information.',
  },
];

function About() {
  const linkClass = 'underline underline-offset-2 rounded-sm hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust-ink';
  return (
    <section id="about" className="bg-rust text-rust-ink py-16 lg:py-24 scroll-mt-20" aria-labelledby="about-title">
      <div className={`${FRAME} grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10`}>
        <div className="lg:col-span-5">
          <h2 id="about-title" className="font-display text-[length:var(--step-head)] leading-tight">
            About LGU Tracker
          </h2>
          <p className="mt-5 text-[length:var(--step-lead)] leading-snug max-w-[36ch]">
            A public view of infrastructure records, and a monitoring workspace for the LGU&rsquo;s own projects.
          </p>
          <div className="mt-6 rounded-2xl bg-white/10 p-5 text-[15px] text-rust-ink/90 space-y-2">
            <p>
              <span className="font-semibold text-rust-ink">Sources.</span> DPWH Transparency Portal contracts and the FY 2027
              National Expenditure Program, as published by BetterGov.ph.
            </p>
            <p>
              <span className="font-semibold text-rust-ink">Limits.</span> Values are shown as reported and are not verified by
              the LGU. Proposals are budget items, not contracts, and are never added to contract totals. No record has a
              photograph of its own site: pictures marked illustrative show the kind of work, never the project.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <h3 className="text-[19px] font-semibold tracking-[-0.01em]">Aligned with three global goals</h3>
          <p className="mt-1.5 text-[15px] text-rust-ink/80 max-w-[60ch]">
            An aim, not a result achieved; the project is not affiliated with or endorsed by the United Nations.
          </p>
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {GOALS.map((goal) => (
              <li key={goal.name} className="rounded-2xl bg-white/10 p-4">
                <h4 className="text-[14px] font-semibold leading-snug">{goal.name}</h4>
                <p className="mt-2 text-[14px] leading-snug text-rust-ink/85">{goal.text}</p>
              </li>
            ))}
          </ul>
          <a
            href="https://sdgs.un.org/goals"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 min-h-12 px-6 rounded-full bg-signal text-night font-semibold text-[15px] transition-[background-color,transform] duration-150 hover:bg-rust-ink active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-rust-ink"
          >
            Read about the goals
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">(opens the United Nations site in a new tab)</span>
          </a>

          <div className="mt-10 pt-6 border-t border-white/20 text-[13px] text-rust-ink/80">
            <h3 className="text-[14px] font-semibold text-rust-ink">Picture credits</h3>
            <p className="mt-1">The photographs show places in the covered regions; none of them is an LGU Tracker project.</p>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
              {Object.values(PHOTOS).map((p) => (
                <li key={p.src}>
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {p.caption}
                  </a>{' '}
                  by {p.creator},{' '}
                  <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {p.license}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function ExploreBand({ totalContracts }: { totalContracts: number | null }) {
  return (
    <section aria-labelledby="explore-band-title" className="bg-ground">
      <Link
        href="/projects"
        className="landing-cta group relative flex flex-col justify-between gap-6 bg-night text-white overflow-hidden transition-colors duration-150 focus-visible:outline-none"
      >
        <h2
          id="explore-band-title"
          className="landing-cta-word block font-display text-signal leading-[0.9] tracking-[-0.04em] text-[27vw] whitespace-nowrap px-3 lg:px-6 pt-6 pb-[7vw] transition-colors duration-150"
        >
          Explore
        </h2>
        <div className={`${FRAME} pb-10 lg:pb-14 flex items-end justify-between gap-6`}>
          <p className="text-[length:var(--step-lead)] leading-snug max-w-[26ch]">
            {totalContracts !== null
              ? `Search ${formatCount(totalContracts)} contracts by place, contractor, category or status.`
              : 'Search the contracts by place, contractor, category or status.'}
          </p>
          <ArrowUpRight className="landing-cta-arrow w-8 h-8 lg:w-12 lg:h-12 shrink-0 transition-transform duration-200" aria-hidden="true" />
        </div>
      </Link>
    </section>
  );
}
