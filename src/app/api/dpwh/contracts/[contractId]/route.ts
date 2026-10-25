import type { NextRequest } from 'next/server';
import { loadDpwhContractDetail } from '@/lib/integrations/dpwh/nationwide/detail';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/dpwh/contracts/:contractId
 *
 * Every stored field of one contract, the LGU review (only visible to staff
 * through RLS), and when the directory last synced successfully.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/dpwh/contracts/[contractId]'>) {
  const { contractId } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });

  const result = await loadDpwhContractDetail(supabase, contractId);
  switch (result.status) {
    case 'invalid':
      return Response.json({ error: 'Invalid contract ID.' }, { status: 400 });
    case 'not_found':
      return Response.json({ error: 'Contract not found.' }, { status: 404 });
    case 'error':
      return Response.json({ error: 'Could not load the contract.' }, { status: 502 });
    case 'ok':
      return Response.json(result.detail);
  }
}
