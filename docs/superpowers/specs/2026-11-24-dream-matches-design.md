# Dream matches: one small Claude endpoint

Items marked **(call)** are the writer's proposals.

## Intent
In the Maxxing 101 app, a person can type a dream in their own words. This endpoint says which category it
fits and whether there is a plan for it. If they typed it under the wrong category ("learn guitar" under Get
fit), the app tells them it fits Learn a skill and lets them switch. The app's five keyword groups can't do this.

## Goals
- One public, no-login endpoint for English, Arabic and Franco-Arabic ("a5es wazn").
- The check is advice. It never blocks a person from continuing.
- The app's promise stays true: "We count requests by area, never your words."

## Non-goals
Database, saved answers, request counts, catalog endpoint, accounts, hosting, and app changes (those are
step 2, with their own design). The request and response allow saved answers and counts to be added later.

## Anti-goals
Strangers running up the bill; storing or logging people's words; onboarding stuck when Claude is down.

## Approaches
- A. Trust the person and don't check: simplest, but "learn guitar" stays under Get fit.
- B. More keywords in the app: free and offline, but three languages to maintain and many misses.
- **C. One small Claude call (picked by the owner).** A larger version of C, with a MongoDB catalog and saved
  answers, was drafted and dropped as too much for today.

## Categories and dreams
One code file, copied from the app's `PathCatalog.kt`. Ids are permanent and never reused.

| Category id | Dream ids |
|---|---|
| `business` | `sell`, `cart`, `service`, `product` (no plan) |
| `skill` | `english`, `code`, `tool` |
| `fitness` | `run`, `gentle` |
| `faith` | `faith` |
| `create` | `film`, `write` (no plan), `make` (no plan) |
| `money` | `cushion`, `debt` |

Each category also has a short English description for Claude. If the app gets an id or kind it doesn't
know, it uses its keyword matcher.

## Endpoint
`POST /v1/dream-matches` with `{ "text": "learn guitar", "area": "fitness" }`

`text` is 1-200 characters after trimming. `area` is a category id or null. Unknown fields are rejected.

Response `200`, always with these keys:

```json
{ "kind": "no_plan", "categoryId": "skill", "fitsArea": false, "dreamId": null,
  "closestDreamId": null, "alternativeDreamIds": [], "notes": [] }
```

| `kind` | Meaning |
|---|---|
| `matched` | `dreamId` has a plan; `alternativeDreamIds` are its category's other planned dreams |
| `no_plan` | A real goal without a plan; `categoryId` is null if it fits no category |
| `unclear` | Too vague; `alternativeDreamIds` holds three options |
| `out_of_scope` | Needs a professional **(call)**: trading or gambling, treating an illness, eating disorders or extreme weight loss, changing medication, pregnancy, legal disputes |
| `not_supported` | Illegal, hateful or sexual goals **(call)** |
| `crisis` | The person may hurt themselves or is in danger **(call)** |

- Ordinary weight loss is `matched` to `gentle` with note `weight_loss`. Quitting smoking is `no_plan` with
  `gentle` as closest and note `health_check`. Both match the app today.
- `fitsArea` is null when no area was sent, and for every kind except `matched` and `no_plan`.

Errors are `{ "code": "..." }`: 400 `invalid_request`, 429 `rate_limited`, 503 `match_unavailable` (daily cap,
Claude failed, timed out or declined). The app treats every non-200 as "use the keyword matcher".

## How it answers
Claude gets the categories, dreams and rules, then the words clearly marked as data. It returns structured
output limited to our ids: a verdict (`goal`, `unclear`, `out_of_scope`, `not_supported`, `crisis`), up to
three categories that fit, exact and closest dreams, and notes. Dreams outside every listed category are
dropped. It isn't told the chosen area; code applies that, so the rules can be tested:

- An exact dream with a plan gives `matched`: one in the area if the area fits, otherwise the first.
- Otherwise `no_plan`: the area if it fits, else the first category that fits, else null. `dreamId` is an exact
  dream there without a plan, or null. `closestDreamId` is the first planned closest dream there; if there is
  none and `dreamId` is set, the category's first planned dream; otherwise null.
- `unclear`: the area's planned dreams, topped up from `english`, `gentle`, `cushion`, to three.

## Settings and limits (call)
- Model from `CLAUDE_MODEL`, default `claude-opus-5-5`, low effort. Server-side refusal fallback is on where
  the model supports it. A decline is `match_unavailable`, never `out_of_scope`.
- 5 seconds in total, no automatic retry.
- In memory, set through the environment: 30 requests a minute and 100 a day per IP, 1,000 Claude calls a day
  overall. Trusting a proxy's forwarded IP must be turned on explicitly.
- The owner sets a spending limit on the Anthropic account and puts `ANTHROPIC_API_KEY` in `.env`. The repo is
  public, so no keys are committed.
- Cost is estimated at $5-7 per 1,000 dreams, not yet measured.

## Privacy
We store nothing and never log the words, and send Anthropic no name, account or IP. Anthropic's own retention
terms apply to what it receives, so the owner checks them and the privacy policy mentions them before release.

## Checking it works
- Automated tests with a fake Claude: every kind and error, the area rules, limits, and that words aren't logged.
- A hand-run check of about 60 phrases in the three languages, including "reach 10k" and attempts to instruct
  the model. Targets: 90% correct category, 85% in each language, 95% answered within 5 seconds, no missed
  crisis phrase. It spends real money, so it runs only with the owner's approval.

## Before release
The phrase check passes. Step 2 adds a crisis screen with confirmed help numbers, and recognises clear crisis
phrases in the app so it works offline; someone qualified reviews those phrases.

## Left to the builder
Test runner, validation and configuration libraries, file layout, prompt wording, category descriptions.
