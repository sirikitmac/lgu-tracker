import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ExternalLink, Map as MapIcon, Search } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BpAssistant } from '@/components/bp/BpAssistant';
import { ArcItem } from '@/components/landing/ArcItem';
import { CountUp } from '@/components/landing/CountUp';
import { CoverageExplorer } from '@/components/landing/CoverageExplorer';
import { PhotoWall } from '@/components/landing/PhotoWall';
import { Reveal } from '@/components/landing/Reveal';
import { StackSteps } from '@/components/landing/StackSteps';
import { anton } from '@/components/landing/fonts';
import { applyFixture, LANDING_FIXTURES, type LandingFixture } from '@/lib/landing/fixtures';
import { PHOTOS, regionName } from '@/components/landing/content';
import { pageCredits } from '@/components/landing/wall';
import { contractMapHref, formatCount, formatDate, formatPeso } from '@/components/dpwh/format';
import { BOUNDARY_SOURCE, SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';
import { loadLandingData, POINTS_PER_REGION, type ExampleContract, type LandingData } from '@/lib/landing/data';

/** Figures come from the database; refresh the prerendered page at most hourly. */
export const revalidate = 3600;

/** One pair of outer margins for every section, aligned with the navigation bar. */
const FRAME = 'mx-auto w-full max-w-7xl px-4 sm:px-6';

/*
 * The landing page wears the work-zone colours of DPWH site signs: signal
 * orange on blue-black night. The hero and the closing card are night in
 * both themes; everything between them follows the theme (ground, surface,
 * ink), with brand fields (signal, peach) keeping fixed night text.
 */
const FOCUS_ON_DARK = 'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-signal';
const FOCUS_ON_LIGHT = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-night';
const FOCUS_THEMED = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/**
 * Runs inline, before the hero is parsed. Marks <html> with data-js (photos
 * may then wait hidden over their blur until loaded, see .photo) and, unless
 * reduced motion is asked for, data-hero-play so the headline's rise
 * (globals.css) starts with the first paint instead of waiting for the JS
 * bundle. Skipped under reduced motion; without scripts the headline simply
 * stands in place. After a client-side navigation it is not run again, and
 * the mark left from an earlier visit (if any) still applies.
 */
const HERO_PLAY_SCRIPT = `try{document.documentElement.setAttribute('data-js','');if(matchMedia('(prefers-reduced-motion: no-preference)').matches)document.documentElement.setAttribute('data-hero-play','')}catch(e){}`;

const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export default async function LandingPage() {
  let data = await loadLandingData();
  let fixtureToggle: React.ReactNode = null;
  // break-ui stress data, development only. The branch, and with it the
  // toggle's import, is removed from production builds, so the switch is
  // neither rendered nor shipped there.
  if (process.env.NODE_ENV === 'development') {
    const { cookies } = await import('next/headers');
    const { FixtureToggle } = await import('@/components/landing/FixtureToggle');
    const value = (await cookies()).get('landing-fixture')?.value as LandingFixture | undefined;
    const fixture: LandingFixture = value && LANDING_FIXTURES.includes(value) ? value : 'demo';
    data = applyFixture(data, fixture);
    fixtureToggle = <FixtureToggle current={fixture} />;
  }

  return (
    <div className={`landing ${anton.variable} min-h-svh flex flex-col bg-ground`}>
      <script dangerouslySetInnerHTML={{ __html: HERO_PLAY_SCRIPT }} />
      <Navbar />
      <Reveal />

      <main className="flex-1">
        <Hero data={data} />
        <Features data={data} />
        <HowItWorks example={data.example} regionPoints={data.regions.find((r) => r.region === 'Region X')?.points ?? []} />
        <Coverage data={data} />
        <AboutData data={data} />
        <Closing />
      </main>

      <Footer />
      {fixtureToggle}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** Primary action: a flat fill whose arrow slides on hover; presses in to 97%. */
function PrimaryLink({ href, children, tone = 'signal' }: { href: string; children: React.ReactNode; tone?: 'signal' | 'white' }) {
  const fill = tone === 'signal' ? 'bg-signal text-night hover:bg-signal-tint' : 'bg-white text-night hover:bg-peach';
  return (
    <Link href={href} className={`lt-btn inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-full font-semibold text-[15px] ${fill} ${FOCUS_ON_DARK}`}>
      {children}
      <ArrowRight className="lt-btn-arrow w-4 h-4" aria-hidden="true" />
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`lt-btn inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-full border-2 border-white/70 text-white font-semibold text-[15px] hover:border-white hover:bg-white/10 ${FOCUS_ON_DARK}`}
    >
      <MapIcon className="w-4 h-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------------- */

/*
 * Headline options considered:
 *   1. "TRACK EVERY PESO. SEE EVERY PROJECT."  (chosen: says what the site does, in plain words)
 *   2. "BANTAY PROYEKTO. EVERY PESO ON THE MAP."
 *   3. "PUBLIC WORKS, IN PUBLIC VIEW."
 * The brand line "Bantay Proyekto" carries the sentence below and the closing marquee.
 */
const HEADLINE: { text: string; signal?: boolean }[][] = [
  [{ text: 'Track every' }, { text: 'peso.', signal: true }],
  [{ text: 'See every' }, { text: 'project.', signal: true }],
];

function Hero({ data }: { data: LandingData }) {
  let order = 0;
  return (
    <section className="hero relative isolate overflow-hidden bg-night text-white" aria-labelledby="hero-title">
      <PhotoWall />

      <div className={`${FRAME} relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-end pt-24 pb-10 lg:pb-14`}>
        <h1 id="hero-title" className="display text-[length:var(--step-hero)] max-w-[14ch] lg:max-w-none">
          {HEADLINE.map((line, l) => (
            <span key={l} className="block">
              {line.map((part) => {
                const i = order++;
                return (
                  <Fragment key={part.text}>
                    <span className="hl-mask">
                      <span className={`hl-word ${part.signal ? 'text-signal' : ''}`} style={{ '--hl-i': i } as React.CSSProperties}>
                        {part.text}
                      </span>
                    </span>{' '}
                  </Fragment>
                );
              })}
            </span>
          ))}
        </h1>

        <p className="hero-sub mt-7 text-[length:var(--step-lead)] leading-snug max-w-[46ch] text-white">
          <span className="font-semibold text-signal">Bantay Proyekto.</span> A free public directory and map of DPWH contracts
          and DILG local projects: what was built, where, by whom and for how much, each linked to its source.
        </p>

        <div className="hero-sub mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <PrimaryLink href="/projects">Explore projects</PrimaryLink>
          <SecondaryLink href="/projects/map">Open the map</SecondaryLink>
        </div>
      </div>

      <Stats data={data} />
    </section>
  );
}

function Stats({ data }: { data: LandingData }) {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const items = [
    data.totalContracts !== null && {
      value: data.totalContracts,
      label: `${plural(data.totalContracts, 'DPWH contract', 'DPWH contracts')} in the Visayas and Mindanao`,
    },
    data.dilgProjects !== null && {
      value: data.dilgProjects,
      label: `${plural(data.dilgProjects, 'DILG project', 'DILG projects')} of local governments, nationwide`,
    },
    data.regionsCovered !== null && {
      value: data.regionsCovered,
      label: plural(data.regionsCovered, 'region with at least one record', 'regions with at least one record'),
    },
    data.datasets !== null && data.datasets.length > 0 && {
      value: data.datasets.length,
      label: plural(data.datasets.length, 'public dataset, linked to its source', 'public datasets, each linked to its source'),
    },
  ].filter(Boolean) as { value: number; label: string }[];

  return (
    <div className="relative border-t border-white/12 bg-night">
      <div className={`${FRAME} py-10 lg:py-12`}>
        <h2 className="sr-only">The directory in figures</h2>
        {items.length > 0 ? (
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
            {items.map((item, i) => (
              <div
                key={item.label}
                data-reveal
                style={{ ...delay(i * 70), '--digits': formatCount(item.value).length } as React.CSSProperties}
                className="stat flex min-w-0 flex-col-reverse justify-end"
              >
                <dt className="mt-2 text-[14px] leading-snug text-white/80 max-w-[26ch]">{item.label}</dt>
                <dd className="stat-figure display text-white">
                  <CountUp value={item.value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[15px] text-white/80">Live figures are unavailable right now; the directory and the map still work.</p>
        )}
        {items.length > 0 && data.computedAt && (
          <p className="mt-6 text-[13px] text-white/70">
            Counts of stored records as of {formatDate(data.computedAt)}, as published by each source.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

const FIELD = {
  night: { card: 'bg-night text-white dark:ring-1 dark:ring-white/12', soft: 'text-white/80', ui: 'bg-white/8 text-white', focus: FOCUS_ON_DARK },
  signal: { card: 'bg-signal text-night', soft: 'text-night/85', ui: 'bg-night/10 text-night', focus: FOCUS_ON_LIGHT },
  peach: { card: 'bg-peach text-night', soft: 'text-night/85', ui: 'bg-white/55 text-night', focus: FOCUS_ON_LIGHT },
  surface: { card: 'bg-surface text-ink', soft: 'text-subtle', ui: 'bg-sunken text-ink', focus: FOCUS_THEMED },
} as const;

function Features({ data }: { data: LandingData }) {
  const cards: { title: string; text: string; href?: string; field: keyof typeof FIELD; visual: React.ReactNode; action?: React.ReactNode }[] = [
    {
      title: 'Search the directory',
      text:
        data.totalContracts !== null && data.dilgProjects !== null
          ? `${formatCount(data.totalContracts + data.dilgProjects)} records by place, title, contractor, category or status.`
          : 'Every record by place, title, contractor, category or status.',
      href: '/projects',
      field: 'night',
      visual: (
        <span data-ui className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2.5 text-[14px] text-white/85">
          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">flood control, Iligan City</span>
        </span>
      ),
    },
    {
      title: 'Read the map',
      text: 'Mapped records cluster by area and open up as you zoom, coloured by status or region.',
      href: '/projects/map',
      field: 'peach',
      visual: <ClusterGlyph />,
    },
    {
      title: 'Jump to a SubayBAYAN code',
      text: 'Paste a DILG project code on the map and it flies straight to the project.',
      href: '/projects/map?layer=subaybayan',
      field: 'surface',
      visual: (
        <span data-ui className="flex items-center justify-between gap-2 rounded-xl bg-sunken px-3.5 py-2.5 text-[14px] text-ink">
          <span className="truncate tabular-nums font-semibold">LIME-25-13-02-00-000-41</span>
          <ArrowUpRight className="w-4 h-4 shrink-0 text-accent-ink" aria-hidden="true" />
        </span>
      ),
    },
    {
      title: 'Filter by agency',
      text: 'DPWH national contracts and DILG local projects side by side, never merged.',
      href: '/projects?agency=DILG',
      field: 'signal',
      visual: (
        <span data-ui className="inline-flex rounded-full bg-night/10 p-1 text-[14px] font-semibold">
          <span className="rounded-full px-4 py-1.5">DPWH</span>
          <span className="rounded-full bg-night px-4 py-1.5 text-signal">DILG</span>
        </span>
      ),
    },
    {
      title: 'Open the dashboard',
      text: 'Totals by region, status, category and year, computed from the stored records.',
      href: '/projects/dashboard',
      field: 'surface',
      visual: <RegionBars data={data} />,
    },
    {
      title: 'Ask BP',
      text: 'Ask the assistant about the stored records in plain words, and get answers drawn from them.',
      field: 'night',
      visual: (
        <span data-ui className="block rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5 text-[14px] text-white/85">
          How many bridge contracts are in Iligan City?
        </span>
      ),
      action: <BpAssistant variant="button" />,
    },
  ];

  return (
    <section id="explore" className="bg-ground py-20 lg:py-32 scroll-mt-16 overflow-hidden" aria-labelledby="explore-title">
      <div className={FRAME}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
          <h2 id="explore-title" data-reveal className="display lg:col-span-7 text-[length:var(--step-head)] text-ink">
            Six ways in<span className="text-accent-ink">.</span>
          </h2>
          <p data-reveal style={delay(70)} className="lg:col-span-5 text-[length:var(--step-lead)] leading-snug text-ink max-w-[40ch]">
            Every card opens a part of LGU Tracker that works today, with no account needed.
          </p>
        </div>

        <ul className="arc-grid mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {cards.map((card, i) => {
            const f = FIELD[card.field];
            const body = (
              <>
                <span className="block text-[22px] font-semibold tracking-[-0.02em] leading-tight pr-10">{card.title}</span>
                <span className={`mt-2 block text-[15px] leading-snug max-w-[36ch] ${f.soft}`}>{card.text}</span>
                <span className="mt-auto block pt-8">{card.visual}</span>
              </>
            );
            return (
              <ArcItem key={card.title} index={i}>
                {card.href ? (
                  <Link href={card.href} className={`feature-card group relative flex h-full min-h-[17rem] flex-col rounded-[24px] p-6 ${f.card} ${f.focus}`}>
                    <span className="feature-arrow absolute top-5 right-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-current/10" aria-hidden="true">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                    {body}
                  </Link>
                ) : (
                  <div className={`relative flex h-full min-h-[17rem] flex-col rounded-[24px] p-6 ${f.card}`}>
                    <span className="block text-[22px] font-semibold tracking-[-0.02em] leading-tight">{card.title}</span>
                    <span className={`mt-2 block text-[15px] leading-snug max-w-[36ch] ${f.soft}`}>{card.text}</span>
                    <span className="mt-auto block pt-8">{card.visual}</span>
                    <span className="landing-bp mt-4 block">{card.action}</span>
                  </div>
                )}
              </ArcItem>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Clusters as the map draws them: counts in circles, larger where there are more. */
function ClusterGlyph() {
  const dots = [
    { x: 40, y: 40, r: 22, n: '1.2k' },
    { x: 112, y: 28, r: 15, n: '312' },
    { x: 170, y: 58, r: 19, n: '804' },
    { x: 92, y: 78, r: 11, n: '46' },
    { x: 226, y: 34, r: 12, n: '97' },
  ];
  return (
    <svg data-ui viewBox="0 0 260 104" className="w-full max-w-[18rem] h-auto" role="img" aria-label="Map clusters with record counts">
      {dots.map((d) => (
        <g key={d.n}>
          <circle cx={d.x} cy={d.y} r={d.r + 6} fill="#FF7A1F" opacity="0.3" />
          <circle cx={d.x} cy={d.y} r={d.r} fill="#FF7A1F" stroke="#050F16" strokeWidth="2" />
          <text x={d.x} y={d.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#050F16">
            {d.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RegionBars({ data }: { data: LandingData }) {
  const top = data.regions
    .filter((r): r is typeof r & { contracts: number } => r.contracts !== null && r.contracts > 0)
    .sort((a, b) => b.contracts - a.contracts)
    .slice(0, 3);
  if (top.length === 0) return null;
  const max = top[0].contracts;
  return (
    <dl data-ui className="w-full space-y-2" aria-label="Regions with the most stored DPWH contracts">
      {top.map((r) => (
        <div key={r.region}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <dt className="truncate text-subtle">{regionName(r.region)}</dt>
            <dd className="font-semibold tabular-nums text-ink">{formatCount(r.contracts)}</dd>
          </div>
          <span className="mt-1 block h-1.5 rounded-full bg-sunken" aria-hidden="true">
            <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${r.contracts / max})` }} />
          </span>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------------- */

function Chips({ items, tone }: { items: string[]; tone: string }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2" aria-label="What this step uses">
      {items.map((c) => (
        <li key={c} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${tone}`}>
          {c}
        </li>
      ))}
    </ul>
  );
}

function StepLayout({
  n,
  title,
  text,
  chips,
  chipTone,
  numberTone,
  softTone,
  visual,
}: {
  n: string;
  title: string;
  text: string;
  chips: string[];
  chipTone: string;
  numberTone: string;
  softTone: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-10 gap-y-8 items-center">
      <div className="md:col-span-7">
        <span className={`display block text-[length:var(--step-figure)] ${numberTone}`} aria-hidden="true">
          {n}
        </span>
        <h3 className="display mt-3 text-[length:var(--step-sub)]">{title}</h3>
        <p className={`mt-4 text-[17px] leading-snug max-w-[44ch] ${softTone}`}>{text}</p>
        <Chips items={chips} tone={chipTone} />
      </div>
      <div className="md:col-span-5">{visual}</div>
    </div>
  );
}

function HowItWorks({ example, regionPoints }: { example: ExampleContract | null; regionPoints: [number, number][] }) {
  const steps = [
    {
      key: 'find',
      className: 'bg-surface text-ink',
      content: (
        <StepLayout
          n="01"
          title="Find a project"
          text="Search by place, title or contractor, or paste a SubayBAYAN code. Narrow it down by agency, region, category or status."
          chips={['SubayBAYAN code', 'Agency: DPWH or DILG', 'Contractor']}
          chipTone="bg-accent-soft text-accent-ink"
          numberTone="text-accent-ink"
          softTone="text-subtle"
          visual={<StepFind example={example} />}
        />
      ),
    },
    {
      key: 'where',
      className: 'bg-peach text-night',
      content: (
        <StepLayout
          n="02"
          title="See where it is"
          text="Contracts sit at the coordinates DPWH reported; LGU projects at their barangay or town, matched by PSGC code, never at a guessed site."
          chips={['PSGC location', 'Map clusters', 'Region filter']}
          chipTone="bg-night/10 text-night"
          numberTone="text-night"
          softTone="text-night/85"
          visual={<StepWhere example={example} regionPoints={regionPoints} />}
        />
      ),
    },
    {
      key: 'verify',
      className: 'bg-signal text-night',
      content: (
        <StepLayout
          n="03"
          title="Verify at the source"
          text="Each record names where it was published and when it was retrieved, with a link back, so you can check it yourself."
          chips={['Source link', 'Retrieved date', 'As reported']}
          chipTone="bg-night/10 text-night"
          numberTone="text-night"
          softTone="text-night/85"
          visual={<StepVerify example={example} />}
        />
      ),
    },
  ];

  return (
    <section id="how-it-works" className="bg-ground pb-20 lg:pb-32 scroll-mt-16" aria-labelledby="how-title">
      <div className={FRAME}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
          <h2 id="how-title" data-reveal className="display lg:col-span-7 text-[length:var(--step-head)] text-ink">
            How it works<span className="text-accent-ink">.</span>
          </h2>
          <p data-reveal style={delay(70)} className="lg:col-span-5 text-[length:var(--step-lead)] leading-snug text-ink max-w-[40ch]">
            Three steps from a question about a road or a hall to the record behind it.
          </p>
        </div>
        <div className="mt-12">
          <StackSteps steps={steps} label="Steps" />
        </div>
      </div>
    </section>
  );
}

const UI_CARD = 'rounded-2xl bg-white text-night p-5 text-[14px] leading-snug';

function StepFind({ example }: { example: ExampleContract | null }) {
  const place = example ? [example.province, example.region && regionName(example.region)].filter(Boolean).join(' · ') : null;
  return (
    <div data-ui className={`${UI_CARD} ring-1 ring-line`}>
      <div className="flex items-center gap-2 rounded-full border-2 border-night px-3.5 py-2.5">
        <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>linamon bridge</span>
      </div>
      {example ? (
        <>
          <p className="mt-4 font-semibold line-clamp-3">{example.title}</p>
          {place && <p className="mt-1 text-night/70">{place}</p>}
        </>
      ) : (
        <p className="mt-4 text-night/70">Results list the title, place, agency and amount.</p>
      )}
    </div>
  );
}

function StepWhere({ example, regionPoints }: { example: ExampleContract | null; regionPoints: [number, number][] }) {
  const lon = example?.longitude ?? null;
  const lat = example?.latitude ?? null;
  // Region X frame, roughly 123.4–125.4 E, 7.2–9.3 N.
  const x = (v: number) => ((v - 123.4) / 2) * 260;
  const y = (v: number) => ((9.3 - v) / 2.1) * 200;
  const mapHref = (example && contractMapHref(example)) || '/projects/map';
  return (
    <div data-ui className={UI_CARD}>
      <svg viewBox="0 0 260 200" className="w-full h-auto rounded-xl bg-[#EDEDEB]" role="img" aria-label="A contract's location among other Northern Mindanao contracts">
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
      {lat !== null && lon !== null && (
        <p className="mt-3 tabular-nums text-night/70">
          {lat.toFixed(4)}° N, {lon.toFixed(4)}° E
        </p>
      )}
      <Link href={mapHref} className={`mt-2 inline-block font-semibold underline underline-offset-4 rounded-sm hover:text-[#A8430B] ${FOCUS_ON_LIGHT}`}>
        See it on the map
      </Link>
    </div>
  );
}

function StepVerify({ example }: { example: ExampleContract | null }) {
  return (
    <div data-ui className={UI_CARD}>
      <dl className="space-y-3">
        {example && (
          <div>
            <dt className="text-night/70">Contract amount, as reported</dt>
            <dd className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{formatPeso(example.contract_amount)}</dd>
          </div>
        )}
        <div>
          <dt className="text-night/70">Source</dt>
          <dd className="font-semibold">DPWH Transparency Portal, via BetterGov.ph (CC0)</dd>
        </div>
        <div>
          <dt className="text-night/70">Contract ID</dt>
          <dd className="font-semibold tabular-nums">{example?.contract_id ?? 'Shown on every record'}</dd>
        </div>
      </dl>
      {example && (
        <Link
          href={`/projects/${encodeURIComponent(example.contract_id)}`}
          className={`lt-btn mt-4 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-night text-white font-semibold hover:bg-[#1b2a35] ${FOCUS_ON_LIGHT}`}
        >
          Open this record <ArrowRight className="lt-btn-arrow w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Coverage({ data }: { data: LandingData }) {
  return (
    <section id="coverage" className="bg-sunken py-20 lg:py-32 scroll-mt-16" aria-labelledby="coverage-title">
      <div className={FRAME}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
          <h2 id="coverage-title" data-reveal className="display lg:col-span-6 text-[length:var(--step-head)] text-ink">
            Where the records are<span className="text-accent-ink">.</span>
          </h2>
          <div data-reveal style={delay(70)} className="lg:col-span-6 space-y-3 max-w-[60ch] text-ink">
            <p className="text-[length:var(--step-lead)] leading-snug">
              DPWH contracts from ten regions of the Visayas and Mindanao, including Northern Mindanao, home to Iligan City.
            </p>
            <p className="text-subtle">
              Luzon and Metro Manila contracts are not stored. DILG SubayBAYAN projects cover every region and live on the
              map&rsquo;s LGU layer.
            </p>
          </div>
        </div>

        <div data-reveal style={delay(120)} className="mt-12">
          <CoverageExplorer regions={data.regions} totalContracts={data.totalContracts} pointsPerRegion={POINTS_PER_REGION} />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-3 text-[15px] text-ink">
          <p className="lg:col-span-8 max-w-[64ch]">
            Also in the directory, nationwide:{' '}
            {data.nepProposals !== null ? `${formatCount(data.nepProposals)} DPWH projects` : 'DPWH projects'} proposed in the FY 2027
            National Expenditure Program. They are budget proposals, not contracts, and carry no coordinates.{' '}
            <Link href="/projects?source=dpwh_nep_2027" className={`font-semibold underline decoration-2 underline-offset-4 rounded-sm hover:text-accent-ink ${FOCUS_THEMED}`}>
              Browse the proposals
            </Link>
          </p>
          {data.computedAt && <p className="lg:col-span-4 lg:text-right text-[13px] text-muted">Figures as of {formatDate(data.computedAt)}.</p>}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function AboutData({ data }: { data: LandingData }) {
  const credits = pageCredits(Object.values(PHOTOS));
  const link = `underline underline-offset-2 rounded-sm hover:text-accent-ink ${FOCUS_THEMED}`;
  const sources = [
    {
      name: 'DPWH contracts',
      by: 'DPWH Transparency Portal, published by BetterGov.ph (CC0)',
      text: `${data.totalContracts !== null ? `${formatCount(data.totalContracts)} contracts` : 'Contracts'} in the Visayas and Mindanao, plus the FY 2027 NEP proposals nationwide.`,
      href: 'https://bettergov.ph',
    },
    {
      name: 'DILG SubayBAYAN',
      by: `Locally funded projects and LIME 20% development fund, retrieved ${SUBAYBAYAN_RETRIEVED_LABEL}`,
      text: `${data.dilgProjects !== null ? `${formatCount(data.dilgProjects)} projects` : 'Projects'} of local governments, a one-time export placed at area centroids, not sites.`,
      href: SUBAYBAYAN_DATASET_INFO.lgsf.url,
    },
    {
      name: 'Boundaries',
      by: `${BOUNDARY_SOURCE.underlying.replace(' (CC BY-IGO)', '')}`,
      text: `Region, province and town shapes (${BOUNDARY_SOURCE.psgc}), under CC BY-IGO, for locating LGU projects.`,
      href: 'https://data.humdata.org/dataset/cod-ab-phl',
    },
  ];

  return (
    <section id="about" className="bg-ground py-20 lg:py-32 scroll-mt-16" aria-labelledby="about-title">
      <div className={`${FRAME} grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10`}>
        <div className="lg:col-span-5">
          <h2 id="about-title" data-reveal className="display text-[length:var(--step-head)] text-ink">
            About the data<span className="text-accent-ink">.</span>
          </h2>
          <p data-reveal style={delay(70)} className="mt-6 text-[length:var(--step-lead)] leading-snug text-ink max-w-[34ch]">
            Values are shown as reported by each source. They are not verified by the LGU.
          </p>
          <p data-reveal style={delay(120)} className="mt-4 text-ink max-w-[44ch]">
            Proposals are budget items, never added to contract totals. DPWH and DILG records stay separate, even when they
            look alike. Photographs on this page are illustrative scenes from the covered regions, not project records.
          </p>
        </div>

        <div className="lg:col-span-7">
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sources.map((s, i) => (
              <li key={s.name} data-reveal style={delay(i * 70)} className="flex flex-col rounded-[20px] bg-surface p-5">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{s.name}</h3>
                <p className="mt-1 text-[13px] leading-snug text-muted">{s.by}</p>
                <p className="mt-3 text-[15px] leading-snug text-ink">{s.text}</p>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={`mt-auto pt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink ${link}`}>
                  Source <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">for {s.name} (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-10 text-[13px] text-subtle">
            <h3 className="text-[14px] font-semibold text-ink">Picture credits</h3>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
              {credits.map((p) => (
                <li key={p.src}>
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className={link}>
                    {p.caption}
                  </a>{' '}
                  by {p.creator},{' '}
                  <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className={link}>
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

const MARQUEE = ['Bantay Proyekto', 'Gabay sa Progreso'];

function Closing() {
  return (
    <section className="bg-ground pb-6 sm:pb-8" aria-labelledby="closing-title">
      {/* Decorative: the brand line, outlined and filled in turn, on a slow loop. */}
      <div className="marquee overflow-hidden py-6 lg:py-10" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="marquee-run">
              {[...MARQUEE, ...MARQUEE].map((t, i) => (
                <span key={i} className={`display marquee-word ${i % 2 ? 'marquee-outline' : 'text-ink'}`}>
                  {t} <span className="text-accent">—</span>{' '}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[90rem] px-2 sm:px-4">
        <div className="closing relative isolate overflow-hidden rounded-[32px] bg-night text-white dark:ring-1 dark:ring-white/12 px-6 py-16 sm:px-12 lg:px-16 lg:py-24">
          <div className="closing-glow" aria-hidden="true" />
          <h2 id="closing-title" data-reveal className="display text-[length:var(--step-head-xl)] max-w-[16ch]">
            What was built <span className="text-signal">near you?</span>
          </h2>
          <p data-reveal style={delay(70)} className="mt-6 text-[length:var(--step-lead)] leading-snug max-w-[44ch] text-white">
            Look up the contracts and local projects in your town, then follow each one back to where it was published.
          </p>
          <div data-reveal style={delay(140)} className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3">
            <PrimaryLink href="/projects">Explore projects</PrimaryLink>
            <SecondaryLink href="/projects/map">Open the map</SecondaryLink>
          </div>
        </div>
      </div>
    </section>
  );
}
