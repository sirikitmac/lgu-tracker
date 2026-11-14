import { redirect } from 'next/navigation';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The dashboard now sits above the map; old links (and their ?region=) land there. */
export default async function DashboardPage({ searchParams }: PageProps<'/projects/dashboard'>) {
  const region = first((await searchParams).region);
  redirect(region ? `/projects/map?stats_region=${encodeURIComponent(region)}` : '/projects/map');
}
