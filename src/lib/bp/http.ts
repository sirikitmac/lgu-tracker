/**
 * Types shared by BP's AI loop (ai.ts) and its Groq transport (groq.ts).
 * No secrets here.
 */

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  models: string[];
}

/** BP's internal chat message; groq.ts converts it to the OpenAI format. */
export interface BpMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { id?: string; function: { name?: string; arguments?: unknown } }[];
  tool_call_id?: string;
}

export interface ChatRequest {
  model: string;
  messages: BpMessage[];
  tools?: unknown[];
  temperature: number;
}

/** Non-2xx answer from the AI API. The message never includes the key. */
export class AiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Provider error code when useful, e.g. 'daily_limit' or 'tool_use_failed'. */
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AiHttpError';
  }
}
