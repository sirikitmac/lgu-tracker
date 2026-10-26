/**
 * Request validation and a small in-memory rate limiter for /api/bp/chat.
 * Pure, so both are unit-tested without a server.
 */

export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 4000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function validateChatRequest(body: unknown): { ok: true; question: string; history: ChatTurn[] } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'The request body must be a JSON object.' };
  const { question, history } = body as { question?: unknown; history?: unknown };

  if (typeof question !== 'string' || question.trim() === '') return { ok: false, error: 'Please type a question.' };
  if (question.length > MAX_QUESTION_CHARS) return { ok: false, error: `Questions must be ${MAX_QUESTION_CHARS} characters or fewer.` };

  const turns: ChatTurn[] = [];
  if (history !== undefined) {
    if (!Array.isArray(history)) return { ok: false, error: 'history must be a list.' };
    for (const turn of history.slice(-MAX_HISTORY_TURNS)) {
      const { role, content } = (turn ?? {}) as { role?: unknown; content?: unknown };
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
        return { ok: false, error: 'Each history entry needs a role (user or assistant) and text content.' };
      }
      if (content.trim()) turns.push({ role, content: content.slice(0, 2000) });
    }
  }
  // Oldest turns are dropped first so the context stays small.
  let total = turns.reduce((n, t) => n + t.content.length, 0);
  while (total > MAX_HISTORY_CHARS && turns.length) total -= turns.shift()!.content.length;
  // Gemini expects the conversation to start with a user turn.
  while (turns[0]?.role === 'assistant') turns.shift();

  return { ok: true, question: question.trim(), history: turns };
}

/**
 * Sliding-window limiter keyed by client IP. State lives in this server
 * instance's memory: on Vercel each warm function instance counts on its
 * own, so this blunts casual abuse but is not a hard global limit.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  return function check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
    }
    recent.push(now);
    hits.delete(key);
    hits.set(key, recent);
    // Map keeps insertion order: evict the least recently seen keys.
    while (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
    return { ok: true };
  };
}
