# KPost UI Test Bench — Operations Manual

How to run this bench, what it produces, how to hand the results to developers, and
what to do when a run comes back wrong. Mirrors `OPERATIONS.md` in the API bench
(`../KPOST-AUTOMATION-v1`) so the two read the same way.

- **What the suite covers and how it is built:** `README.md`
- **The working contract (locators, fixtures, golden rules):** `CLAUDE.md`
- **This file:** running it, reading its reports, delivering them.

---

## 1. What this bench does

Drives the KPost React app (`https://localhost:3000`) through Playwright across four
browser projects — chromium, firefox, webkit, mobile-chrome. **63 specs × 4 projects
= 252 tests.**

Every run produces, automatically:

1. **`BUG_REPORT.md` / `BUG_REPORT.json`** — the application defects the run observed;
   the developer deliverable.
2. **`DEV_DIGEST.md` / `.json`** — the one-screen triage summary.
3. **`playwright-report/`** — Playwright's own HTML report with traces, video and
   screenshots (~225 MB per run — the deep-trace reference).
4. **A POST to the external QA Dashboard** under application slug `kpost-ui`.

All four come from one in-memory run model (`src/reporting/run-model.ts`), so they
cannot disagree about what happened.

**All of it is generated and gitignored.** Every run rewrites the report files whole,
so nothing in the repo can go stale and no report is ever half of one run and half of
another. The corollary: a report exists only until the next run overwrites it. To keep
one — to attach to a ticket, or to compare against a later run — copy it out before
re-running:

```bash
cp BUG_REPORT.md "../kpost-ui-$(date +%Y%m%d-%H%M).md"
```

The QA Dashboard is the durable record: it keeps every run it received, so the history
lives there rather than in this working tree.

---

## 2. Setup

```bash
npm install && npx playwright install     # first run only
cp .env.example .env                      # then fill in real test-user credentials
```

`.env` is gitignored. Every variable is documented in `.env.example`; the ones that
matter operationally:

| Variable | Effect |
| --- | --- |
| `BASE_URL` | The app under test. Also the source of the environment label when `TEST_ENV` is unset. |
| `TEST_ENV` | Overrides the environment label (`Local` / `QA` / `Staging` / `Production`). Leave unset to infer it from `BASE_URL`. |
| `STANDARD_USER_*`, `ADMIN_USER_*` | Required. Missing → startup fails loudly, by design. |
| `DASHBOARD_INGEST_URL`, `DASHBOARD_API_KEY` | Both or neither. Unset → the dashboard push no-ops. |
| `MAIL_RECIPIENT`, `DIRECTORY_USER_*` | Optional accounts that un-skip gated specs. |

---

## 3. Running tests

```bash
npm test                  # everything, all four projects (252 tests)
npm run test:serial       # workers=1 — REQUIRED for app-dependent runs, see below
npm run test:smoke        # @smoke only
npm run test:regression   # @regression only
npm run test:list         # count/enumerate without executing (posts nothing)
```

By browser: `test:chromium`, `test:firefox`, `test:webkit`, `test:mobile`.
By area: `test:auth`, `test:home`, `test:kmail`, `test:kdirectory`, `test:katchup`,
`test:settings`, `test:kecommerce`, `test:knews`, `test:kpay`.

Combine freely: `npm run test:kmail -- --project=chromium`.

```bash
npm run test:ui           # time-travel debugging
npm run test:headed       # watch it drive
npm run codegen           # record real selectors against the live app
npm run ci                # typecheck → lint → test (the gate before pushing)
```

**Run app-dependent suites serially.** KPost allows roughly one active session per
account, so parallel workers on the shared test user fight each other — a full
parallel run failed 6/12 where the same run serially passed 8/12. Until per-worker
accounts exist, use `npm run test:serial`.

---

## 4. Reports

### `BUG_REPORT.md` — the bug ledger *(root, generated, automatic)*

Executive summary, defect counts by severity and module, an index table, then full
detail per defect: evidence, expected behaviour, and which tests observed it in this
run. Hand this to a developer as-is.

### `BUG_REPORT.json` — machine twin *(root, generated, automatic)*

Same content, same field names as the API bench's (`generatedAt`, `environment`,
`baseURL`, `run`, `summary`, `defects[]`). Its `defects[]` objects already satisfy the
dashboard's ingest contract, which is why the pushed payload is a projection of this
document rather than a separately-built one.

### `DEV_DIGEST.md` / `.json` — triage summary *(root, generated, automatic)*

One screen: verdict, execution table, the defects seen. `npm run digest` prints it.

### `playwright-report/` — traces *(generated, automatic)*

`npm run report` opens it (port 9324). Failure traces, screenshots and video. This is
where you go after the digest tells you *which* test to look at.

### The QA Dashboard — external *(automatic)*

`src/reporting/dashboard-reporter.ts` POSTs each run to `DASHBOARD_INGEST_URL` with a
Bearer key, under application slug **`kpost-ui`**. It sends the run summary plus every
known defect the run observed, upserted by its stable `KPOST-*` id.

Guarantees: unset env vars → clean no-op; 15-second timeout; a dashboard outage prints
a warning and **never** fails the run; and a listing run (`test:list`, or a `--grep`
matching nothing) posts nothing at all.

---

## 5. Known application defects

When a test fails because the *app* is wrong, register it in
`src/utils/known-defects.ts` and call `noteKnownDefect()` at the top of the test. That
puts the defect in the HTML report, `results.json`, `junit.xml`, `BUG_REPORT.*`,
`DEV_DIGEST.md` and the dashboard — from one registration.

**The annotated test still fails.** The registry documents a defect; it never
suppresses one. Three rules: never weaken an assertion to make one go green; delete
the entry the day the app is fixed (a stale entry excuses a real regression); and
never invent an entry to explain a failure you have not reproduced.

---

## 6. When a run comes back incomplete

This is the failure mode worth knowing by name. A degraded app can kill a run after a
handful of tests. Ten tests that pass out of 252 planned is **not** a small green run,
and this bench refuses to let it look like one.

**How it shows up.** In the terminal, before any pass rate:

```
[dashboard] ⚠ run INCOMPLETE: 10/252 tests reached a result (status=interrupted). Dashboard will flag this run.
[dashboard]   - Playwright ended the run with status "interrupted" — it stopped before working through the plan.
[dashboard]   - 10 of 252 planned tests reached a result; 242 never produced one.
[dashboard]   Counts are reported as observed — nothing is scaled to the plan.
```

`BUG_REPORT.md` and `DEV_DIGEST.md` both open with an **⚠ INCOMPLETE RUN** banner. On
the dashboard the run is flagged suspect, because it receives `totalTests: 252` with
only 10 accounted for and its own consistency check catches the gap. Any warning the
dashboard returns is echoed back into your terminal.

**What is deliberately NOT done:** the planned total is never reduced to match what
finished, and the counts are never scaled up to the plan. A truncated run must look
truncated.

**What to do.**

1. Is the app actually up? Open `BASE_URL` in a browser. KPost's first authenticated
   paint can exceed 10s; a dead app looks similar for the first few seconds.
2. Read the first *failing* test in `npm run report`. A truncated run usually has one
   real cause at the front and 200 casualties behind it.
3. Check whether the app raised a dev-server overlay — `assertNoAppErrorOverlay()`
   surfaces the real compiler or runtime error instead of "element not found".
4. Re-run serially: `npm run test:serial`. If the first run died on session
   contention, this is the fix.
5. Only once the run completes should you read its pass rate as coverage.

---

## 7. Troubleshooting

**Ingest returns 401.** The key does not match the `kpost-ui` application. Re-issue it
on the dashboard's Applications page. Using the API bench's key merges two suites into
one row.

**Ingest connection refused.** The dashboard is not running. Harmless — the run is
complete and `BUG_REPORT.md` has everything. Re-running the suite is the only way to
re-push, so read the file report instead.

**Env label reads `Unknown`.** `BASE_URL`'s host matched none of the known patterns.
Set `TEST_ENV` explicitly.

**Report files missing.** Only a run that executed at least one test writes them. A
listing run writes nothing by design.

**`.env` changes seem to have no effect.** `env.ts` freezes its config at import; a
watch-mode process started before the edit still holds the old values. Restart it.

**The KMail send test and the logout redirect test fail.** Expected — both are real
app defects (KPOST-KMAIL-002, KPOST-AUTH-001) with registry entries. That is correct
signal, not test debt.

---

## Reference

| Need | Where |
| --- | --- |
| Suite tour, architecture | `README.md` |
| Locators, fixtures, golden rules, app ground truth | `CLAUDE.md` |
| Defect registry | `src/utils/known-defects.ts` |
| Run model (single source of truth for all reports) | `src/reporting/run-model.ts` |
| Environment label logic | `src/utils/environment.ts` |
| Dashboard ingest contract | `../QA-Dashboard/src/lib/validation.ts` |
| API bench conventions | `../KPOST-AUTOMATION-v1/OPERATIONS.md` |
| Point-in-time bench analysis (archived) | `docs/archive/TEST-BENCH-REPORT.md` |
