import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
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
import { loadLandingData, POINTS_PER_REGION, type ExampleContract, type LandingData } from '@/lib/landing/data';

/** Figures come from the database; refresh the prerendered page at most hourly. */
export const revalidate = 3600;

/** One pair of outer margins for every section. */
const FRAME = 'mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-12';

const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

export default async function LandingPage() {
  const data = await loadLandingData();

  return (
    <div className="landing min-h-svh flex flex-col bg-white">
      <Navbar />
      <Reveal />

      <main className="flex-1">
        <Hero data={data} />
        <WhyNow data={data} />
        <CommunityImpact />
        <Coverage data={data} />
        <HowItWorks example={data.example} regionPoints={data.regions.find((r) => r.region === 'Region X')?.points ?? []} />
        <Sdgs />
        <ExploreBand totalContracts={data.totalContracts} />
        <Credits />
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Hero({ data }: { data: LandingData }) {
  const photo = PHOTOS.sanJuanico;
  return (
    <section className="relative flex flex-col overflow-hidden lg:min-h-[calc(100svh-4.3rem)]" aria-labelledby="hero-title">
      <div className="flex-1 bg-signal">
        <div className={`${FRAME} pt-[9svh] pb-12 lg:pt-[10svh] lg:pb-16`}>
          <h1
            id="hero-title"
            className="font-serif text-[length:var(--step-display)] leading-[0.86] text-night lg:max-w-[62%]"
          >
            Bantay
            <br />
            Proyekto.
          </h1>
          <p
            className="landing-rise mt-8 lg:mt-10 text-[length:var(--step-lead)] leading-snug text-night max-w-[40ch]"
            style={delay(200)}
          >
            LGU Tracker is a public directory and map of DPWH contracts: what was built, where, by
            whom and for how much.
          </p>
        </div>
      </div>

      <div className="relative bg-night text-white">
        <div className={`${FRAME} flex flex-col pt-8 lg:py-10`}>
          <figure className="relative z-10 order-last ml-auto mt-10 -mb-24 w-[58%] sm:w-[42%] rotate-[5deg] lg:order-none lg:absolute lg:right-[6vw] lg:bottom-[calc(100%-5.5rem)] lg:mt-0 lg:mb-0 lg:w-[30vw] lg:max-w-[460px]">
            <div className="landing-shutter relative aspect-[3/4] overflow-hidden rounded-t-full bg-rust">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                preload
                sizes="(min-width: 1024px) 30vw, 58vw"
                className="object-cover object-[62%_50%]"
              />
            </div>
            <figcaption className="mt-3 text-[length:var(--step-small)] text-white/90 lg:text-night lg:sr-only">
              {photo.caption}
            </figcaption>
          </figure>

          <div className="lg:max-w-[58%] flex flex-col sm:flex-row sm:items-center gap-x-8 gap-y-5">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center gap-2 min-h-14 px-7 bg-signal text-night font-semibold text-[length:var(--step-body)] transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-signal"
            >
              Explore projects
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>
            <Link
              href="/projects/map"
              className="inline-flex items-center gap-2 min-h-12 font-semibold text-[length:var(--step-body)] underline decoration-2 underline-offset-[6px] decoration-signal hover:text-signal transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-signal"
            >
              Open the project map
            </Link>
          </div>
          <p className="mt-6 text-[length:var(--step-small)] text-white/85 lg:max-w-[58%]">
            {data.totalContracts !== null
              ? `${formatCount(data.totalContracts)} contracts from ten regions of the Visayas and Mindanao`
              : 'Contracts from ten regions of the Visayas and Mindanao'}
            {data.nepProposals !== null ? `, plus ${formatCount(data.nepProposals)} proposed projects nationwide.` : '.'}{' '}
            <span className="lg:hidden">Pictured: {photo.caption}.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function WhyNow({ data }: { data: LandingData }) {
  const photo = PHOTOS.route9;
  const figures = [
    data.totalAmount !== null && {
      value: formatPesoCompact(data.totalAmount),
      label: 'in contract amounts, as published, across the stored records',
    },
    data.totalContracts !== null && {
      value: formatCount(data.totalContracts),
      label: 'DPWH contracts that anyone can search without signing in',
    },
    data.ongoingContracts !== null && {
      value: formatCount(data.ongoingContracts),
      label: 'of them reported as still ongoing',
    },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <section id="why" className="pt-32 pb-24 lg:py-40 scroll-mt-20" aria-labelledby="why-title">
      <div className={`${FRAME} grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-14`}>
        <div className="lg:col-span-7">
          <h2 id="why-title" data-reveal className="font-serif text-[length:var(--step-head)] leading-[0.95] max-w-[14ch]">
            Why it matters now
          </h2>
          <p data-reveal style={delay(80)} className="mt-8 text-[length:var(--step-lead)] leading-snug max-w-[36ch]">
            Roads, bridges and flood defences are paid for with public money, yet the record behind a work site is
            hard to find.
          </p>
          <div data-reveal style={delay(160)} className="mt-8 space-y-5 max-w-[62ch]">
            <p>
              The information exists. DPWH publishes contracts on its Transparency Portal, and the budget proposes
              new projects every year. But it is spread across portals, spreadsheets and PDFs that are difficult to
              search by place, and most residents only ever see the signboard at the site.
            </p>
            <p>
              Recent public scrutiny of flood-control and road spending has made the question practical: what was
              contracted near me, who is building it, and is it finished? LGU Tracker gathers those records in one
              place so the question can be answered in a minute, not a records request.
            </p>
          </div>

          {figures.length > 0 && (
            <dl className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-8">
              {figures.map((f, i) => (
                <div key={f.label} data-reveal style={delay(220 + i * 80)}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd>
                    <span className="block font-serif text-[length:var(--step-head)] leading-none tabular-nums">{f.value}</span>
                    <span className="mt-3 block text-[length:var(--step-small)] leading-snug">{f.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <figure data-reveal style={delay(120)} className="lg:col-span-5 lg:pt-4">
          <div className="relative aspect-[4/5] overflow-hidden bg-stone">
            <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 38vw, 100vw" className="object-cover object-[52%_60%]" />
          </div>
          <figcaption className="mt-3 text-[length:var(--step-small)]">{photo.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const AUDIENCES: { name: string; text: string; photo: LandingPhoto; bg: string; ink: string; tilt: number }[] = [
  {
    name: 'Citizens',
    text: 'Look up what is being built in your town or province, who the contractor is, and how far the work has gone.',
    photo: PHOTOS.iligan,
    bg: 'bg-signal',
    ink: 'text-night',
    tilt: -3,
  },
  {
    name: 'Students',
    text: 'Use real public-works records for papers, capstone projects and data exercises: searchable, sourced and free to read.',
    photo: PHOTOS.wmsu,
    bg: 'bg-white',
    ink: 'text-night',
    tilt: 2,
  },
  {
    name: 'Researchers',
    text: 'Compare regions, categories and contract amounts across tens of thousands of records, each linked to its published source.',
    photo: PHOTOS.rizalMap,
    bg: 'bg-peach',
    ink: 'text-night',
    tilt: -2,
  },
  {
    name: 'Civic groups',
    text: 'Bring project details to barangay assemblies, community monitoring and dialogues with local offices.',
    photo: PHOTOS.sanJuanico,
    bg: 'bg-rust',
    ink: 'text-rust-ink',
    tilt: 3,
  },
];

function CommunityImpact() {
  return (
    <section id="impact" className="bg-night text-white py-24 lg:py-36 overflow-hidden" aria-labelledby="impact-title">
      <div className={FRAME}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-6 items-end">
          <h2 id="impact-title" data-reveal className="lg:col-span-6 font-serif text-[length:var(--step-head)] leading-[0.95]">
            Who it is for
          </h2>
          <p data-reveal style={delay(80)} className="lg:col-span-6 text-[length:var(--step-lead)] leading-snug max-w-[34ch]">
            Anyone with a question about a public work, and no time to file a records request.
          </p>
        </div>

        <ul className="mt-14 xl:mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4 xl:mx-auto xl:block xl:relative xl:h-[30rem] xl:w-[68rem]">
          {AUDIENCES.map((a, i) => (
            <li
              key={a.name}
              data-reveal
              style={{ ...delay(i * 90), '--tilt': `${a.tilt}deg`, left: `${i * 15.625}rem` } as React.CSSProperties}
              className={`landing-fan-card xl:absolute xl:top-0 xl:w-[21.25rem] xl:h-[27.5rem] ${a.bg} ${a.ink} p-7 flex flex-col`}
            >
              <div className="xl:max-w-[13.5rem] flex flex-col h-full">
                <h3 className="font-serif text-[length:var(--step-lead)] leading-none">{a.name}</h3>
                <div className="relative mt-5 aspect-[4/3] overflow-hidden">
                  <Image src={a.photo.src} alt={a.photo.alt} fill sizes="(min-width: 1280px) 216px, 80vw" className="object-cover" />
                </div>
                <p className="mt-5 leading-snug">{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function Coverage({ data }: { data: LandingData }) {
  return (
    <section id="coverage" className="bg-signal py-24 lg:py-36 scroll-mt-16" aria-labelledby="coverage-title">
      <div className={FRAME}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-6">
          <h2 id="coverage-title" data-reveal className="lg:col-span-5 font-serif text-[length:var(--step-head)] leading-[0.95]">
            Where the records are
          </h2>
          <div data-reveal style={delay(80)} className="lg:col-span-7 space-y-4 max-w-[60ch]">
            <p className="text-[length:var(--step-lead)] leading-snug">
              Ten regions of the Visayas and Mindanao, including Northern Mindanao, home to Iligan City.
            </p>
            <p>
              Contracts come from the DPWH Transparency Portal snapshot published by BetterGov.ph. To fit the
              project&rsquo;s database, LGU Tracker stores contracts whose project location is in these regions;
              Luzon and Metro Manila are not included. The import of the snapshot is not finished yet, so the
              counts below are the records stored so far.
            </p>
          </div>
        </div>

        <div data-reveal style={delay(140)} className="mt-16">
          <CoverageExplorer regions={data.regions} totalContracts={data.totalContracts} pointsPerRegion={POINTS_PER_REGION} />
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-4">
          <p data-reveal className="lg:col-span-7 max-w-[62ch]">
            Also in the directory, nationwide:{' '}
            {data.nepProposals !== null ? `${formatCount(data.nepProposals)} DPWH projects` : 'DPWH projects'} proposed in
            the FY 2027 National Expenditure Program. They carry no coordinates, so they appear in the list but not on
            the map.{' '}
            <Link
              href="/projects?source=dpwh_nep_2027"
              className="font-semibold underline decoration-2 underline-offset-4 hover:bg-night hover:text-signal transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-night"
            >
              Browse the proposals
            </Link>
          </p>
          {data.computedAt && (
            <p className="lg:col-span-5 lg:text-right text-[length:var(--step-small)]">
              Figures as of {formatDate(data.computedAt)}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const STEPS = [
  { clause: 'First, search a place, project or contractor.', field: 'bg-stone', ink: 'text-night' },
  { clause: 'Then find where it is on the map.', field: 'bg-peach', ink: 'text-night' },
  { clause: 'Open the record: amount, contractor, progress.', field: 'bg-signal', ink: 'text-night' },
  { clause: 'Follow it back to the published source.', field: 'bg-night', ink: 'text-white' },
] as const;

function HowItWorks({ example, regionPoints }: { example: ExampleContract | null; regionPoints: [number, number][] }) {
  return (
    <section id="how-it-works" className="scroll-mt-16" aria-labelledby="how-title">
      <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.clause}
            className={`landing-step ${step.field} ${step.ink} min-h-[36rem] xl:min-h-[44rem] px-5 sm:px-8 lg:px-10 py-10 flex flex-col`}
          >
            {i === 0 ? (
              <h2 id="how-title" className="font-serif text-[length:var(--step-head)] leading-[0.95]">
                How it works
              </h2>
            ) : (
              <div className="hidden xl:block h-[calc(var(--step-head)*0.95)]" aria-hidden="true" />
            )}
            <div data-reveal style={delay(i * 90)} className="landing-step-card mt-10 xl:mt-16 w-full max-w-[19rem]">
              <StepCard step={i} example={example} regionPoints={regionPoints} />
            </div>
            <p className="mt-auto pt-10 font-serif text-[length:var(--step-lead)] leading-tight max-w-[16ch]">{step.clause}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The same real contract, one step further along in each field. */
function StepCard({ step, example, regionPoints }: { step: number; example: ExampleContract | null; regionPoints: [number, number][] }) {
  const base = 'bg-white text-night p-5 text-[length:var(--step-small)] leading-snug';
  const title = example?.title ?? 'Contract title';
  const place = example ? [example.province, example.region && regionName(example.region)].filter(Boolean).join(' · ') : 'Province · Region';

  if (step === 0) {
    return (
      <div data-ui className={base}>
        <div className="flex items-center gap-2 border-2 border-night px-3 py-2">
          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>linamon bridge</span>
        </div>
        <p className="mt-4 font-semibold line-clamp-3">{title}</p>
        <p className="mt-1">{place}</p>
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
        <svg viewBox="0 0 260 200" className="w-full h-auto bg-stone" role="img" aria-label="Contract location among other Northern Mindanao contracts">
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
          <p className="mt-1 tabular-nums">
            {lat.toFixed(4)}° N, {lon.toFixed(4)}° E
          </p>
        )}
        {mapHref && (
          <Link href={mapHref} className="mt-3 inline-block font-semibold underline underline-offset-4 hover:text-[#B45309]">
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
            <dt>Contract amount</dt>
            <dd className="font-serif text-[length:var(--step-lead)] leading-none tabular-nums">{formatPeso(example?.contract_amount)}</dd>
          </div>
          <div>
            <dt>Contractor</dt>
            <dd className="font-semibold line-clamp-2">{example?.contractor ?? 'Not reported'}</dd>
          </div>
          <div>
            <dt>
              {example ? `${statusLabel(example.status)} · ${categoryLabel(example.category)}` : 'Status'}
            </dt>
            <dd className="mt-1.5">
              <span className="block h-2 bg-stone">
                <span className="block h-full bg-signal" style={{ width: `${Math.min(100, Math.max(0, progress ?? 0))}%` }} />
              </span>
              <span className="mt-1 block tabular-nums">
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
          <dt>Contract ID</dt>
          <dd className="font-semibold tabular-nums">{example?.contract_id ?? 'Not available'}</dd>
        </div>
        <div>
          <dt>Implementing office</dt>
          <dd className="font-semibold">{example?.implementing_office ?? 'Not reported'}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd className="font-semibold">DPWH Transparency Portal, via BetterGov.ph (CC0)</dd>
        </div>
      </dl>
      <p className="mt-4">Shown as published; not verified by the LGU.</p>
      {example && (
        <Link
          href={`/projects/${encodeURIComponent(example.contract_id)}`}
          className="mt-4 inline-flex items-center gap-1.5 min-h-11 px-4 bg-night text-white font-semibold hover:bg-signal hover:text-night transition-colors"
        >
          Open this record <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

const GOALS = [
  {
    name: 'SDG 9 · Industry, innovation and infrastructure',
    text: 'Resilient infrastructure starts with knowing what exists. Making records of roads, bridges, flood-control works and public buildings easy to find and compare supports better planning and upkeep.',
  },
  {
    name: 'SDG 11 · Sustainable cities and communities',
    text: 'Residents and local planners can see which projects touch their town or province, which supports informed participation in how their communities grow.',
  },
  {
    name: 'SDG 16 · Peace, justice and strong institutions',
    text: 'Targets 16.6 and 16.10 call for transparent, accountable institutions and public access to information. Opening contract records to anyone is a small step in that direction.',
  },
];

function Sdgs() {
  const photo = PHOTOS.marceloFernan;
  return (
    <section id="sdgs" className="py-5 sm:py-8 bg-white" aria-labelledby="sdg-title">
      <div className="mx-2.5 sm:mx-5 bg-rust text-rust-ink overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-x-12 px-6 sm:px-10 lg:px-14 pt-14 lg:pt-20">
          <div className="lg:col-span-6 lg:row-start-1">
            <h2 id="sdg-title" data-reveal className="font-serif text-[length:var(--step-head)] leading-[0.95] max-w-[13ch]">
              Aligned with three global goals
            </h2>
            <p data-reveal style={delay(80)} className="mt-6 max-w-[44ch]">
              These are the Sustainable Development Goals this work is meant to support. They describe an aim, not a
              result LGU Tracker has achieved, and the project is not affiliated with or endorsed by the United Nations.
            </p>
          </div>

          <div className="mt-12 lg:mt-0 lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:row-span-2 lg:pb-20">
            <ul className="space-y-12 max-w-[34rem]">
              {GOALS.map((goal, i) => (
                <li key={goal.name} data-reveal style={delay(i * 90)}>
                  <h3 className="font-serif text-[length:var(--step-lead)] leading-tight">{goal.name}</h3>
                  <p className="mt-3">{goal.text}</p>
                </li>
              ))}
            </ul>
            <a
              href="https://sdgs.un.org/goals"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-12 inline-flex items-center gap-2 min-h-14 px-7 bg-signal text-night font-semibold transition-[background-color,transform] duration-150 hover:bg-rust-ink active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-rust-ink"
            >
              Read about the goals
              <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
              <span className="sr-only">(opens the United Nations site in a new tab)</span>
            </a>
          </div>

          <div className="lg:col-span-6 lg:row-start-2 flex items-end">
            <div
              data-reveal
              style={delay(140)}
              className="relative mt-14 lg:mt-16 w-[86%] sm:w-[64%] lg:w-full max-w-[520px] mx-auto lg:mx-0 aspect-[4/5] -mb-[22%] rounded-t-full overflow-hidden"
            >
              <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 34vw, 86vw" className="object-cover object-[38%_50%]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function ExploreBand({ totalContracts }: { totalContracts: number | null }) {
  return (
    <section aria-labelledby="explore-title" className="bg-white">
      <Link
        href="/projects"
        className="landing-cta group relative flex flex-col justify-between gap-6 bg-night text-white overflow-hidden transition-colors duration-150 focus-visible:outline-none"
      >
        <h2
          id="explore-title"
          className="landing-cta-word block font-serif text-signal leading-[0.9] tracking-[-0.04em] text-[34vw] whitespace-nowrap px-3 lg:px-6 pt-6 pb-[7vw] transition-colors duration-150"
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

/* ------------------------------------------------------------------------- */

function Credits() {
  return (
    <section aria-labelledby="credits-title" className="bg-white py-14">
      <div className={`${FRAME} grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-6 text-[length:var(--step-small)]`}>
        <div className="lg:col-span-4 space-y-3">
          <h2 id="credits-title" className="text-[length:var(--step-body)] font-semibold">
            Picture and data credits
          </h2>
          <p className="max-w-[44ch]">
            Contract records: DPWH Transparency Portal snapshot and FY 2027 NEP, published by BetterGov.ph. The
            photographs show places in the covered regions; none of them is an LGU Tracker project.
          </p>
        </div>
        <ul className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
          {Object.values(PHOTOS).map((p) => (
            <li key={p.src}>
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#B45309]">
                {p.caption}
              </a>{' '}
              by {p.creator},{' '}
              <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#B45309]">
                {p.license}
              </a>
              , via Wikimedia Commons
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
