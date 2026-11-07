import 'server-only';
import { AiHttpError, type AiConfig, type BpMessage, type ChatRequest } from './http';

/**
 * Groq side of BP: OpenAI-compatible Chat Completions, plain fetch.
 * GROQ_API_KEY is read here and never leaves the server.
 *
 * Free tier (no card): limits are per organization and per model, roughly
 * 30 requests/min and 1,000 requests or 200k tokens per day for gpt-oss.
 * Check https://console.groq.com/settings/limits for the current numbers.
 */

export const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
export const DEFAULT_GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';
/** Caps each reply; Groq counts it toward the per-minute token budget. */
const MAX_COMPLETION_TOKENS = 1024;

/** null = GROQ_API_KEY not set. */
export function groqConfig(): AiConfig | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  const primary = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const fallback = process.env.GROQ_FALLBACK_MODEL?.trim() || DEFAULT_GROQ_FALLBACK_MODEL;
  return { baseUrl: DEFAULT_GROQ_BASE_URL, apiKey, models: [...new Set([primary, fallback])] };
}

interface GroqToolCall {
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
}

interface GroqResponse {
  choices?: { message?: { role?: string; content?: string | null; tool_calls?: GroqToolCall[] } }[];
  error?: { message?: string; code?: string; type?: string };
}

/** Internal messages → OpenAI format (tool calls need ids, arguments as a JSON string). */
function toGroqMessages(messages: BpMessage[]) {
  return messages.map((m) => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.tool_call_id ?? '', content: m.content };
    if (m.role === 'assistant' && m.tool_calls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.tool_calls.map((c) => ({
          id: c.id ?? '',
          type: 'function',
          function: { name: c.function.name ?? '', arguments: typeof c.function.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function.arguments ?? {}) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

/** True for Groq's per-day limits (RPD/TPD), which do not clear in a minute. */
export function isDailyLimit(status: number, message: string): boolean {
  return status === 429 && /per day|\((RPD|TPD)\)/i.test(message);
}

export async function postGroqChat(config: AiConfig, request: ChatRequest, signal: AbortSignal): Promise<{ message: BpMessage }> {
  const body = {
    model: request.model,
    messages: toGroqMessages(request.messages),
    ...(request.tools ? { tools: request.tools, tool_choice: 'auto' } : {}),
    temperature: request.temperature,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    stream: false,
  };
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
    signal,
    cache: 'no-store',
  });
  const text = await res.text();
  let json: GroqResponse | null = null;
  try {
    json = text ? (JSON.parse(text) as GroqResponse) : null;
  } catch {
    // Not JSON (proxy error page): handled below.
  }
  if (!res.ok) {
    const message = json?.error?.message ?? res.statusText ?? '';
    const code = isDailyLimit(res.status, message) ? 'daily_limit' : json?.error?.code;
    throw new AiHttpError(res.status, message.slice(0, 200), code);
  }
  const msg = json?.choices?.[0]?.message;
  if (!msg) throw new AiHttpError(502, 'Groq returned no message.');
  return {
    message: {
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls?.map((c) => ({ id: c.id, function: { name: c.function?.name, arguments: c.function?.arguments } })),
    },
  };
}
