/**
 * DashboardReporter — the run's reporting engine.
 *
 * Registered unconditionally in `playwright.config.ts`, so every script that runs
 * Playwright (`npm test`, `test:smoke`, `test:serial`, CI, …) reports automatically.
 * It runs ALONGSIDE the html/json/junit reporters, never instead of them — the
 * Playwright HTML report stays the deep-trace reference.
 *
 * On `onEnd` it does three things, in order, from ONE model:
 *   1. builds the run model (`run-model.ts`) — counts, completeness, defects;
 *   2. writes `BUG_REPORT.json` / `BUG_REPORT.md` / `DEV_DIGEST.md` / `DEV_DIGEST.json`;
 *   3. POSTs the same model to the external QA Dashboard (application slug `kpost-ui`).
 *
 * The API bench splits these across two reporters and documents an ordering rule to
 * keep them in step; building one model and projecting it removes the possibility of
 * a mismatch rather than relying on config order to prevent one.
 *
 * Behaviour preserved from the original:
 *  - `DASHBOARD_INGEST_URL` / `DASHBOARD_API_KEY` unset → clean no-op, one log line.
 *  - A dashboard failure NEVER fails the run: the results are already on disk.
 *  - 15s upload timeout, `Authorization: Bearer <key>`, defects mapped from
 *    `src/utils/known-defects.ts` by their stable `KPOST-*` id.
 *
 * ── Ingest contract (QA-Dashboard/src/lib/validation.ts) ──
 *   { generatedAt: ISO-8601, environment: string,
 *     run: { totalTests, passed, failed, skipped, durationMs },
 *     defects: [{ id, displayId, title, severity, module, owner, method,
 *                 endpointPath, description, requestBody, expected, actual }] }
 * Runs are upserted per `generatedAt`; defects are upserted by `id`.
 *
 * ## Reporting a truncated run
 *
 * `totalTests` is what Playwright PLANNED (236 = 59 specs × 4 projects). The outcome
 * counts are what actually happened. When the app under test is degraded and the run
 * dies after ten tests, this posts `totalTests: 236, passed+failed+skipped: 10` — the
 * true numbers, unrescaled. That gap is precisely what the dashboard's
 * `assessRunReport()` flags as a suspect run, so a truncated run LOOKS truncated
 * there instead of looking like a small green success.
 *
 * The same condition prints a WARNING in the terminal, banners `BUG_REPORT.md` and
 * `DEV_DIGEST.md`, and is carried in the payload as `run.status` / `run.incomplete`.
 * Those two extra fields are advisory: the dashboard's Zod schema is non-strict, so
 * it currently STRIPS them rather than storing them. They cost nothing, they light up
 * for free if the dashboard ever adds support, and none of the honesty depends on
 * them — the count gap and the local warning carry that on their own.
 */
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { env } from '../config/env';
import { KNOWN_APP_DEFECTS, type KnownDefect } from '../utils/known-defects';
import { writeBugReport } from './bug-report';
import { writeDevDigest } from './dev-digest';
import { type DefectSighting, buildRunModel, verdict } from './run-model';

const UPLOAD_TIMEOUT_MS = 15_000;

export default class DashboardReporter implements Reporter {
  private startedAt = 0;
  private total = 0;
  private projects: string[] = [];
  /** Test ids that began at least one attempt. Zero of these means nothing ran. */
  private readonly begun = new Set<string>();
  /** Terminal status of each test's LAST attempt, keyed by test id. */
  private readonly outcomes = new Map<string, string>();
  private readonly sightings = new Map<string, { defect: KnownDefect; seen: DefectSighting[] }>();

  onBegin(config: FullConfig, suite: Suite): void {
    this.startedAt = Date.now();
    this.total = suite.allTests().length;
    /*
     * The root suite's children are the SELECTED project suites, so a
     * `--project=chromium` run reports chromium. `config.projects` is the
     * configured list and would claim all four browsers ran when one did — a
     * report that overstates its own coverage.
     */
    this.projects =
      suite.suites.length > 0
        ? suite.suites.map((projectSuite) => projectSuite.title)
        : config.projects.map((project) => project.name);
    if (!env.dashboard.ingestUrl) {
      console.info(
        '[dashboard] DASHBOARD_INGEST_URL not set — this run will not be posted to the QA dashboard.',
      );
    }
  }

  onTestBegin(test: TestCase): void {
    this.begun.add(test.id);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Last attempt wins: `onTestEnd` fires once per retry, and a test that failed
    // then passed is one passed test, not one failure plus one pass.
    this.outcomes.set(test.id, result.status);

    for (const annotation of test.annotations) {
      if (annotation.type !== 'known-app-defect' || !annotation.description) continue;
      const defect = Object.values(KNOWN_APP_DEFECTS).find((known) =>
        annotation.description?.startsWith(`${known.id} `),
      );
      if (!defect) continue;
      const entry = this.sightings.get(defect.id) ?? { defect, seen: [] };
      entry.seen.push({
        testTitle: test.title,
        project: test.parent.project()?.name ?? 'unknown',
        status: result.status,
      });
      this.sightings.set(defect.id, entry);
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    /*
     * `--list` and a `--grep` that matches nothing both reach `onEnd` having executed
     * nothing at all. Publishing those as runs filed a `totalTests: 236, 0/0/0` row on
     * the dashboard — flagged suspect, indistinguishable from a real catastrophic
     * failure — every time anyone listed the suite. A dry run is not a run.
     */
    if (this.begun.size === 0) {
      console.info(
        '[dashboard] no test executed (listing or empty selection) — nothing reported. ' +
          'Reports and the dashboard are left untouched.',
      );
      return;
    }

    const model = buildRunModel({
      status: result.status,
      environment: env.testEnv,
      baseURL: env.baseURL,
      totalTests: this.total,
      projects: this.projects,
      durationMs: Date.now() - this.startedAt,
      outcomes: this.outcomes,
      sightings: this.sightings,
    });

    // Loudest first: whoever is watching the terminal must see truncation before they
    // see a pass rate.
    if (model.run.incomplete) {
      console.warn(
        `\n[dashboard] ⚠ run INCOMPLETE: ${model.run.accounted}/${model.run.totalTests} tests ` +
          `reached a result (status=${result.status}). Dashboard will flag this run.\n` +
          model.run.incompleteReasons.map((reason) => `[dashboard]   - ${reason}`).join('\n') +
          '\n[dashboard]   Counts are reported as observed — nothing is scaled to the plan.\n',
      );
    }

    // File reports are the deliverable and must survive a dashboard outage, so they
    // are written first and their failure is contained.
    try {
      const reports = writeBugReport(model);
      const digest = writeDevDigest(model);
      console.info(
        `[reports] wrote ${relative(reports.markdown)}, ${relative(reports.json)}, ` +
          `${relative(digest.markdown)}, ${relative(digest.json)} — ${verdict(model)}`,
      );
    } catch (error) {
      console.warn(`[reports] could not write the file reports: ${messageOf(error)}`);
    }

    await this.push(model);
  }

  private async push(model: ReturnType<typeof buildRunModel>): Promise<void> {
    const { ingestUrl, apiKey } = env.dashboard;
    if (!ingestUrl || !apiKey) return;

    const payload = {
      generatedAt: model.generatedAt,
      environment: model.environment,
      run: {
        totalTests: model.run.totalTests,
        passed: model.run.passed,
        failed: model.run.failed,
        skipped: model.run.skipped,
        durationMs: model.run.durationMs,
        // Advisory (currently stripped by the dashboard's non-strict schema).
        status: model.run.status,
        incomplete: model.run.incomplete,
        incompleteReasons: model.run.incompleteReasons,
      },
      defects: model.defects,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        console.warn(`[dashboard] ingest rejected the run: HTTP ${response.status} ${detail}`);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as {
        runId?: number;
        inserted?: number;
        updated?: number;
        warnings?: string[];
      };
      console.info(
        `[dashboard] run posted: runId=${body.runId} defects inserted=${body.inserted} ` +
          `updated=${body.updated} (${model.run.passed} passed / ${model.run.failed} failed / ` +
          `${model.run.skipped} skipped of ${model.run.totalTests} planned)`,
      );
      /*
       * The dashboard answers with its own consistency findings. Dropping them — which
       * this reporter used to do — meant the one system that had noticed the run was
       * inconsistent told us so and we threw the message away.
       */
      for (const warning of body.warnings ?? []) {
        console.warn(`[dashboard] ⚠ flagged this run: ${warning}`);
      }
    } catch (error) {
      // Never fail the suite over reporting — the html/json/junit reports and the
      // BUG_REPORT/DEV_DIGEST files already captured everything locally.
      console.warn(
        `[dashboard] could not reach ${ingestUrl}: ${messageOf(error)}. ` +
          'The run is still recorded in BUG_REPORT.md and playwright-report/.',
      );
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function relative(absolute: string): string {
  return absolute.split(/[\\/]/).pop() ?? absolute;
}
