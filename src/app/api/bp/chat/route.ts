import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDirectoryOverview, searchProjects, type BpRecord } from '@/lib/bp/data';
import { answerWithGemini, classifyGeminiError, geminiConfig, type GeminiFailure } from '@/lib/bp/gemini';
import { planPreview, previewOverviewAnswer, previewSearchAnswer } from '@/lib/bp/preview';
import { createRateLimiter, validateChatRequest } from '@/lib/bp/validate';

/**
 * POST /api/bp/chat  { question: string, history?: { role, content }[] }
 *
 * BP, the LGU Tracker assistant. Retrieves public directory data with the
 * caller's Supabase client (publishable key, RLS applies) through predefined
 * read-only queries, and asks Gemini to explain it. GEMINI_API_KEY is
 * server-only. Without it, development serves a labelled non-AI preview and
 * production answers 503.
 *
 * 200 → { mode: 'gemini' | 'preview', answer, references }
 * 4xx/5xx → { error, code } with a message safe to show to users.
 */

export const maxDuration = 30;

const TIMEOUT_MS = 25_000;
const MAX_BODY_BYTES = 32_000;
const perMinute = createRateLimiter({ limit: 8, windowMs: 60_000 });
const perHour = createRateLimiter({ limit: 60, windowMs: 3_600_000 });

const fail = (status: number, code: string, error: string, headers?: HeadersInit) =>
  Response.json({ error, code }, { status, headers });

const GEMINI_ERRORS: Record<GeminiFailure, [number, string]> = {
  rate_limited: [503, 'BP is receiving too many requests right now. Please try again in a minute.'],
  busy: [503, 'The AI service is busy right now (high demand). Please try again in a minute.'],
  auth: [503, 'BP is not configured correctly on the server (the Gemini API key was rejected).'],
  timeout: [504, 'BP took too long to answer. Please try again or ask a narrower question.'],
  upstream: [502, 'BP could not reach the AI service. Please try again shortly.'],
  empty: [502, 'BP could not produce an answer. Please rephrase your question.'],
  database: [502, 'BP could not read the project database right now. Please try again shortly.'],
};

function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  const key = clientKey(request);
  const limited = [perMinute(key), perHour(key)].find((r) => !r.ok);
  if (limited && !limited.ok) {
    return fail(429, 'rate_limited', 'You are sending questions too quickly. Please wait a moment and try again.', {
      'Retry-After': String(limited.retryAfterSeconds),
    });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'The request is too large.');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'invalid_request', 'The request body must be JSON.');
  }
  const input = validateChatRequest(body);
  if (!input.ok) return fail(400, 'invalid_request', input.error);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail(503, 'database_not_configured', 'The project database is not configured on this server.');

  const config = geminiConfig();
  if (!config && process.env.NODE_ENV === 'production') {
    return fail(503, 'gemini_not_configured', 'BP is not available yet: the Gemini API key has not been configured on the server.');
  }

  const overview = await getDirectoryOverview(supabase);

  if (!config) {
    // Development preview: same read-only queries, templated answer, no AI.
    if (!overview.ok) return fail(502, 'database_error', GEMINI_ERRORS.database[1]);
    const plan = planPreview(input.question, overview.data);
    let answer: string;
    let references: BpRecord[] = [];
    if (plan.tool === 'overview') {
      answer = previewOverviewAnswer(overview.data, plan.focus);
    } else {
      const result = await searchProjects(supabase, plan.args);
      if (!result.ok) return fail(502, 'database_error', GEMINI_ERRORS.database[1]);
      answer = previewSearchAnswer(result.data);
      references = result.data.records;
    }
    return Response.json({ mode: 'preview', answer, references });
  }

  try {
    const { answer, records } = await answerWithGemini({
      config,
      supabase,
      overview: overview.ok ? overview.data : null,
      history: input.history,
      question: input.question,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return Response.json({ mode: 'gemini', answer, references: records });
  } catch (error) {
    const kind = classifyGeminiError(error);
    // Status and kind only: never the request, the records, or the key.
    console.error('[LGU Tracker] BP chat failed:', kind, (error as { status?: number })?.status ?? '');
    const [status, message] = GEMINI_ERRORS[kind];
    return fail(status, `gemini_${kind}`, message);
  }
}
