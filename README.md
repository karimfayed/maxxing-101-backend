# maxxing-101-backend

The backend for the Maxxing 101 app, built with NestJS.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY`. `.env` is never committed.
3. `npm run start:dev`

Without a key the server starts with a warning, and every dream match answers 503.

| Setting | Default | What it does |
|---|---|---|
| `PORT` | 3000 | The port to listen on |
| `ANTHROPIC_API_KEY` | none | From the Claude Console |
| `CLAUDE_MODEL` | `claude-opus-5-5` | The model that sorts dreams |
| `REQUESTS_PER_MINUTE` | 30 | Per IP |
| `REQUESTS_PER_DAY` | 100 | Per IP |
| `CLAUDE_CALLS_PER_DAY` | 1000 | For everyone together, by UTC day |
| `TRUST_PROXY_HOPS` | 0 | How many proxies to trust for the caller's IP. Set it only behind a proxy |

The limits are counted in memory and start again when the server restarts. Set a spending limit in the Claude
Console as the real ceiling.

## Commands

- `npm test`: every test. None of them calls Claude.
- `npm run typecheck`, `npm run build`
- `npm run check:phrases`: checks the real model against 60 phrases. It costs money, so it refuses to run
  without `-- --spend-money`.

## `POST /v1/dream-matches`

Says which category a typed dream fits, and whether there is a plan for it. Public, with no login.

```json
{ "text": "learn guitar", "area": "fitness" }
```

`text` is 1-200 characters in English, Arabic or Franco-Arabic. `area` is the category it was typed under
(`business`, `skill`, `fitness`, `faith`, `create`, `money`), or null.

```json
{
  "kind": "no_plan",
  "categoryId": "skill",
  "fitsArea": false,
  "dreamId": null,
  "closestDreamId": null,
  "alternativeDreamIds": [],
  "notes": []
}
```

| `kind` | Meaning |
|---|---|
| `matched` | `dreamId` has a plan; `alternativeDreamIds` are its category's other planned dreams |
| `no_plan` | A real goal without a plan; `categoryId` is null if it fits no category |
| `unclear` | Too vague; `alternativeDreamIds` holds three options |
| `out_of_scope` | Needs a professional |
| `not_supported` | Illegal, hateful or sexual goals |
| `crisis` | The person may hurt themselves or is in danger |

`notes` may hold `weight_loss` or `health_check`.

Errors are `{ "code": "..." }`. The app falls back to its keyword matcher on any of them.

| Status | Code |
|---|---|
| 400 | `invalid_request` |
| 404 | `not_found` |
| 429 | `rate_limited` |
| 500 | `internal_error` |
| 503 | `match_unavailable` |

The words are not stored or logged. They are sent to Anthropic with no name, account or IP.
