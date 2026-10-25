import type { NextRequest } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorize';
import { collectIliganCandidates } from '@/lib/integrations/dpwh/iligan/collect';
import { DPWH_DATASET, classifyDpwhRows, groupByContractId } from '@/lib/integrations/dpwh/normalize';
import { DPWH_REVISIONS, readDpwhRows } from '@/lib/integrations/dpwh/source';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ADMIN_ROLES } from '@/types/auth';
import type { DpwhDryRunReport, DpwhPreviewAction } from '@/types/dpwhImport';

/**
 * GET /api/admin/dpwh-import/preview?limit=25
 * GET /api/admin/dpwh-import/preview?scope=iligan   (full Iligan City candidate report)
 *
 * DRY RUN ONLY. Reads a small sample of DPWH contracts for the Iligan City
 * District Engineering Office from BetterGov.ph's pinned Hugging Face
 * snapshot and reports what an import would insert, update, skip, or reject.
 * It never writes to Supabase: the only database access is a read of
 * public.projects reference codes, made as the signed-in administrator
 * under RLS.
 *
 * Until an imported-records table exists, the previous dataset revision
 * stands in as the "already imported" baseline, so updates reflect real
 * changes between two published DPWH snapshots.
 */

const DISTRICT_ENGINEERING_OFFICE = 'Iligan City DEO';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

function errorResponse(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(...ADMIN_ROLES);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const status = { NOT_CONFIGURED: 503, UNAUTHENTICATED: 401, FORBIDDEN: 403 }[error.code];
      return errorResponse(status, error.message);
    }
    throw error;
  }

  const scope = request.nextUrl.searchParams.get('scope');
  if (scope !== null && scope !== 'iligan') {
    return errorResponse(400, 'scope must be omitted or "iligan".');
  }
  if (scope === 'iligan') {
    try {
      const report = await collectIliganCandidates();
      return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.error('[LGU Tracker] DPWH Iligan collection failed:', error);
      return errorResponse(502, 'Could not read the DPWH source dataset. No data was changed.');
    }
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return errorResponse(400, `limit must be an integer from 1 to ${MAX_LIMIT}.`);
  }

  const source = DPWH_REVISIONS.current;
  let current;
  let sampleIds: string[];
  let baselineRows;
  try {
    current = await readDpwhRows(source, {
      match: (row) => row.office === DISTRICT_ENGINEERING_OFFICE,
      limit,
    });
    sampleIds = current.rows.flatMap((row) => (row.contractId ? [row.contractId] : []));
    const sample = new Set(sampleIds);
    baselineRows = (
      await readDpwhRows(DPWH_REVISIONS.previous, {
        match: (row) => row.office === DISTRICT_ENGINEERING_OFFICE && sample.has(row.contractId ?? ''),
      })
    ).rows;
  } catch (error) {
    console.error('[LGU Tracker] DPWH source read failed:', error);
    return errorResponse(502, 'Could not read the DPWH source dataset. No data was changed.');
  }

  const supabase = await createSupabaseServerClient();
  const { data: localProjects, error: localError } = await supabase!
    .from('projects')
    .select('reference_code')
    .in('reference_code', sampleIds);
  if (localError) {
    console.error('[LGU Tracker] Reading local reference codes failed:', localError);
    return errorResponse(500, 'Could not check local projects for conflicts. No data was changed.');
  }

  const baseline = groupByContractId(baselineRows);
  const entries = classifyDpwhRows(current.rows, source, {
    baseline,
    localReferenceCodes: new Set(localProjects.map((p) => p.reference_code as string)),
  });

  const summary: Record<DpwhPreviewAction, number> = { insert: 0, update: 0, skip: 0, reject: 0 };
  for (const entry of entries) summary[entry.action] += 1;

  const report: DpwhDryRunReport = {
    dryRun: true,
    generatedAt: new Date().toISOString(),
    filter: { districtEngineeringOffice: DISTRICT_ENGINEERING_OFFICE, limit },
    source: {
      dataset: DPWH_DATASET,
      ...source,
      rowsInFile: current.rowsInFile,
      rowsMatchingFilter: current.rowsMatchingFilter,
    },
    baseline: {
      description: 'Previous published revision of the same dataset (stand-in for already-imported records).',
      revision: DPWH_REVISIONS.previous.sha,
      records: baselineRows.length,
    },
    summary,
    entries,
    notes: [
      'Dry run: nothing was written to Supabase.',
      'Filtered by DPWH District Engineering Office, whose jurisdiction is not the same as the Iligan City boundary.',
      'The source provides no barangay or municipality fields; they are intentionally left out.',
      'Original data: DPWH Transparency Portal. Compilation: BetterGov.ph (CC0-1.0).',
    ],
  };

  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
}
