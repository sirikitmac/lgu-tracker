# BP — LGU Tracker AI Assistant

"Talk to BP" on the Project Directory (`/projects`) opens a floating chat that answers questions from the
directory's Supabase data, with an Ollama model (Ollama Cloud API) writing the explanation.

## How it works

```
BpAssistant (client)  ──POST /api/bp/chat──▶  route.ts (server)
                                               ├─ validate input, rate limit (8/min, 60/h per IP, per instance)
                                               ├─ Supabase (publishable key, RLS) ── get_directory_overview → dpwh_directory_stats (cached totals)
                                               │                                  └─ search_projects       → project_directory (≤ 8 rows + exact count)
                                               └─ Ollama POST /api/chat (OLLAMA_API_KEY, tool calling) picks the tool + arguments, explains the result
```

- The model never writes SQL. It can only call the two read-only tools in `src/lib/bp/tools.ts`; their arguments go
  through `parseDirectoryQuery`, the same validator as `/api/dpwh/contracts`.
- Totals, counts, and rankings come from the database (stats cache or `count: 'exact'`), never from the model.
- The record links under an answer are the rows the server retrieved, not text parsed from the answer.
- No service-role key is used: queries run as the anonymous/signed-in visitor under the existing RLS policies.

## How BP calls Ollama

`src/lib/bp/ollama.ts` (server-only) sends `POST {OLLAMA_BASE_URL}/api/chat` with
`{ model, messages, tools, stream: false }` and `Authorization: Bearer <OLLAMA_API_KEY>`, using plain `fetch`.

- Tools are declared as `{ type: "function", function: { name, description, parameters } }`. The model answers with
  `message.tool_calls`; each result goes back as a `{ role: "tool", tool_name, content }` message.
- At most 3 tool rounds and 4 calls per round. The last round is sent without tools, so the model has to answer.
- Each attempt on a model that has a fallback gets 8 s. On 429, 5xx, or a timeout BP tries the fallback model and
  skips the busy model for 2 minutes (per server instance). A rejected key (401/403) is not retried.
- Model names must be exactly as listed at `{OLLAMA_BASE_URL}/api/tags` (`curl https://ollama.com/api/tags`).
  The direct API does **not** use the CLI `name:cloud` form. Pick models whose `capabilities` include `tools`.
  The defaults are `gpt-oss:120b` with `gpt-oss:20b` as the lighter fallback.

## Configure the Ollama key

Create a key at <https://ollama.com/settings/keys>.

### Local

Add the key to `.env.local` (git-ignored by the `.env*` rule) and restart `npm run dev`:

```
OLLAMA_API_KEY=your-key
# optional (defaults shown in .env.example)
# OLLAMA_BASE_URL=https://ollama.com
# OLLAMA_MODEL=gpt-oss:120b
# OLLAMA_FALLBACK_MODEL=gpt-oss:20b
```

To use a local Ollama server instead, set `OLLAMA_BASE_URL=http://localhost:11434` and local model names. No key is
needed, and none is sent to a local URL.

Without a key, `npm run dev` answers in **preview mode**: the same database queries, a templated answer, and a
"Preview mode · not AI-generated" label. A production build without a key answers `503 ai_not_configured`.

### Vercel

Local `.env.local` values are **not** uploaded; Vercel needs its own copy.

1. Vercel dashboard → the project → **Settings → Environment Variables**.
2. Add `OLLAMA_API_KEY` (do **not** prefix it with `NEXT_PUBLIC_`). Select Production (and Preview if wanted).
   Mark it **Sensitive**.
3. Optionally add `OLLAMA_MODEL` / `OLLAMA_FALLBACK_MODEL` (and `OLLAMA_BASE_URL`).
4. Redeploy: environment variables apply only to deployments made after they are saved.

## Errors shown to users

| Situation | HTTP | code |
|---|---|---|
| Empty / too long / malformed question | 400 | `invalid_request` |
| Too many questions from one IP | 429 | `rate_limited` |
| Key missing (production) | 503 | `ai_not_configured` |
| Key rejected by Ollama (401/403) | 503 | `ai_auth` |
| Ollama quota / rate limit (after trying the fallback model) | 503 | `ai_rate_limited` |
| Ollama overloaded (after trying the fallback model) | 503 | `ai_busy` |
| Ollama or database slow (> 25 s) | 504 | `ai_timeout` |
| Ollama unreachable or other upstream error | 502 | `ai_upstream` |
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
preview routing, the Ollama client against a mocked `fetch`: tool rounds, rejected arguments, fallback, timeouts,
rejected key, error classification).
