# BP — LGU Tracker AI Assistant

"Talk to BP" on the Project Directory (`/projects`) opens a floating chat that answers questions from the
directory's Supabase data, with Gemini writing the explanation.

## How it works

```
BpAssistant (client)  ──POST /api/bp/chat──▶  route.ts (server)
                                               ├─ validate input, rate limit (8/min, 60/h per IP, per instance)
                                               ├─ Supabase (publishable key, RLS) ── get_directory_overview → dpwh_directory_stats (cached totals)
                                               │                                  └─ search_projects       → project_directory (≤ 8 rows + exact count)
                                               └─ Gemini (GEMINI_API_KEY, function calling) picks the tool + arguments, explains the result
```

- Gemini never writes SQL. It can only call the two read-only tools in `src/lib/bp/tools.ts`; their arguments go
  through `parseDirectoryQuery`, the same validator as `/api/dpwh/contracts`.
- Totals, counts, and rankings come from the database (stats cache or `count: 'exact'`), never from the model.
- The record links under an answer are the rows the server retrieved, not text parsed from the answer.
- No service-role key is used: queries run as the anonymous/signed-in visitor under the existing RLS policies.

## Configure the Gemini key

### Local

Add the key to `.env.local` (git-ignored by the `.env*` rule) and restart `npm run dev`:

```
GEMINI_API_KEY=your-key
# optional: defaults gemini-3.5-flash, falling back to gemini-3.5-flash-lite when busy
# GEMINI_MODEL=
# GEMINI_FALLBACK_MODEL=
```

Without a key, `npm run dev` answers in **preview mode**: the same database queries, a templated answer, and a
"Preview mode · not AI-generated" label. A production build without a key answers `503 gemini_not_configured`.

### Vercel

Local `.env.local` values are **not** uploaded; Vercel needs its own copy.

1. Vercel dashboard → the project → **Settings → Environment Variables**.
2. Add `GEMINI_API_KEY` (do **not** prefix it with `NEXT_PUBLIC_`). Select Production (and Preview if wanted).
   Mark it **Sensitive**.
3. Optionally add `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`.
4. Redeploy: environment variables apply only to deployments made after they are saved.

## Errors shown to users

| Situation | HTTP | code |
|---|---|---|
| Empty / too long / malformed question | 400 | `invalid_request` |
| Too many questions from one IP | 429 | `rate_limited` |
| Key missing (production) | 503 | `gemini_not_configured` |
| Key rejected by Google | 503 | `gemini_auth` |
| Gemini quota / rate limit | 503 | `gemini_rate_limited` |
| Gemini overloaded (after trying the fallback model) | 503 | `gemini_busy` |
| Gemini or database slow (> 25 s) | 504 | `gemini_timeout` |
| Database unreachable | 502 | `database_error` / `gemini_database` |

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
preview routing, error classification).
