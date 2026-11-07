# BP — LGU Tracker AI Assistant

"Talk to BP" on the Project Directory (`/projects`) opens a floating chat that answers questions from the
directory's Supabase data, with a model on **Groq** (free tier) writing the explanation.

## How it works

```
BpAssistant (client)  ──POST /api/bp/chat──▶  route.ts (server)
                                               ├─ validate input, rate limit (8/min, 60/h per IP, per instance)
                                               ├─ Supabase (publishable key, RLS) ── get_directory_overview → dpwh_directory_stats (cached totals)
                                               │                                  └─ search_projects       → project_directory (≤ 8 rows + exact count)
                                               └─ Groq POST /chat/completions (GROQ_API_KEY, tool calling)
                                                  picks the tool + arguments, explains the result
```

- The model never writes SQL. It can only call the two read-only tools in `src/lib/bp/tools.ts`; their arguments go
  through `parseDirectoryQuery`, the same validator as `/api/dpwh/contracts`.
- Totals, counts, and rankings come from the database (stats cache or `count: 'exact'`), never from the model.
- The record links under an answer are the rows the server retrieved, not text parsed from the answer.
- No service-role key is used: queries run as the anonymous/signed-in visitor under the existing RLS policies.

## How BP calls Groq

`src/lib/bp/groq.ts` (server-only) sends `POST https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible)
with `Authorization: Bearer <GROQ_API_KEY>`. Tool calls carry an `id`; each result goes back as
`{ role: "tool", tool_call_id, content }`. The tool loop, fallback, and error handling live in `src/lib/bp/ai.ts`.

- Defaults: `openai/gpt-oss-120b`, falling back to `openai/gpt-oss-20b` (override with `GROQ_MODEL` /
  `GROQ_FALLBACK_MODEL`).
- Free tier limits are per model and per organization (roughly 30 requests/min and 1,000 requests or 200k tokens
  per day; check <https://console.groq.com/settings/limits>). One question uses 2-4 requests.
- A per-day limit (429 "per day") skips that model for 30 minutes and tries the fallback; when both are out, users
  see "used up its free AI allowance for today". A 413 (request larger than the per-minute token budget) also
  tries the fallback, then answers `ai_too_large`.

### Configure Groq

1. Create a key at <https://console.groq.com/keys> (free, no card).
2. Add `GROQ_API_KEY=your-key` to `.env.local` and restart `npm run dev`.
3. On Vercel, add `GROQ_API_KEY` under Settings → Environment Variables (Sensitive, not `NEXT_PUBLIC_`) and
   redeploy.

## Tool loop

- At most 3 tool rounds and 4 calls per round. The last round is sent without tools, so the model has to answer.
- Each attempt on a model that has a fallback gets 8 s. On 429, 413, 5xx, a malformed tool call, or a timeout BP
  tries the fallback model and skips the failing one for 2 minutes (30 minutes after a daily limit), per server
  instance. A rejected key (401/403) is not retried.

Without `GROQ_API_KEY`, `npm run dev` answers in **preview mode**: the same database queries, a templated answer,
and a "Preview mode · not AI-generated" label. A production build without a key answers `503 ai_not_configured`.

## Errors shown to users

| Situation | HTTP | code |
|---|---|---|
| Empty / too long / malformed question | 400 | `invalid_request` |
| Too many questions from one IP | 429 | `rate_limited` |
| Key missing (production) | 503 | `ai_not_configured` |
| Key rejected by the AI service (401/403) | 503 | `ai_auth` |
| Groq free daily limit used up on every model | 503 | `ai_daily_limit` |
| Conversation over Groq's per-minute token budget (413) | 503 | `ai_too_large` |
| Per-minute rate limit (after trying the fallback model) | 503 | `ai_rate_limited` |
| AI service overloaded (after trying the fallback model) | 503 | `ai_busy` |
| AI service or database slow (> 25 s) | 504 | `ai_timeout` |
| AI service unreachable or other upstream error | 502 | `ai_upstream` |
| Database unreachable | 502 | `database_error` / `ai_database` |

Server logs record only the error kind and HTTP status, never questions, records, or keys.

## Limitations

- The rate limiter is in memory, so each Vercel function instance counts separately. For a hard global limit,
  add a Vercel Firewall rate-limit rule on `/api/bp/chat` (no code change) or a shared store such as Upstash Redis.
- City / municipality is not reported for DPWH contracts; place questions use full-text search on titles, IDs,
  contractors, and offices, which can match records that only mention the place (for example a road name).
- Overview statistics cover DPWH contracts and refresh after each successful sync (`dpwh_directory_stats`).
- Some rare filters can hit the anonymous statement timeout on the count query; BP then reports the count as
  unavailable rather than guessing.

## Tests

`npm test` includes `tests/bp/bp.test.ts` (validation, rate limiting, argument validation, read-only access,
preview routing, the Groq client against a mocked `fetch`: tool rounds, rejected arguments, fallback, timeouts,
rejected key, daily limit, error classification).
