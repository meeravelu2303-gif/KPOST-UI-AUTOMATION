/**
 * DashboardReporter — posts every run to the external QA Dashboard.
 *
 * Registered unconditionally in `playwright.config.ts`, so every script that
 * runs Playwright (`npm test`, `test:smoke`, `test:serial`, CI, …) reports
 * automatically. It runs ALONGSIDE the html/json/junit reporters, never
 * instead of them — the Playwright HTML report stays the local reference.
 *
 * Behaviour:
 *  - When `DASHBOARD_INGEST_URL` / `DASHBOARD_API_KEY` are unset, it logs one
 *    line and does nothing (local devs without the dashboard lose nothing).
 *  - A dashboard failure NEVER fails the run: results were already recorded
 *    by the other reporters, so losing the upload is a warning, not an error.
 *
 * ── Ingest contract (read from QA-Dashboard/src/lib/validation.ts, and
 *    verified live against POST /api/ingest on 2026-08-13) ──
 *   {
 *     generatedAt: ISO-8601, environment: string,
 *     run: { totalTests, passed, failed, skipped, durationMs },
 *     defects: [{ id, displayId, title, severity, module, owner, method,
 *                 endpointPath, description, requestBody, expected, actual }]
 *   }
 * Auth is `Authorization: Bearer <key>`; runs are upserted (a fresh
 * `generatedAt` per run means each run gets its own row) and defects are
 * upserted by their stable `id`, so re-reporting the same defect updates it.
 *
 * The dashboard's per-item unit is the **defect**, not the test — so what
 * gets sent is the run summary plus every `known-app-defect` annotation the
 * run actually observed, mapped back to the registry in
 * `src/utils/known-defects.ts` for severity/module/evidence. The `actual`
 * field carries which tests hit the defect and with what outcome.
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

interface DefectSighting {
  defect: KnownDefect;
  /** "title (status)" per test that carried the annotation. */
  sightings: string[];
}

const UPLOAD_TIMEOUT_MS = 15_000;

export default class DashboardReporter implements Reporter {
  private startedAt = 0;
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private total = 0;
  private readonly defects = new Map<string, DefectSighting>();

  onBegin(_config: FullConfig, suite: Suite): void {
    this.startedAt = Date.now();
    this.total = suite.allTests().length;
    if (!env.dashboard.ingestUrl) {
      console.info(
        '[dashboard] DASHBOARD_INGEST_URL not set — this run will not be posted to the QA dashboard.',
      );
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // outcome() folds retries: 'flaky' means it passed on retry.
    switch (test.outcome()) {
      case 'expected':
      case 'flaky':
        this.passed += 1;
        break;
      case 'unexpected':
        this.failed += 1;
        break;
      case 'skipped':
        this.skipped += 1;
        break;
    }

    for (const annotation of test.annotations) {
      if (annotation.type !== 'known-app-defect' || !annotation.description) continue;
      const defect = Object.values(KNOWN_APP_DEFECTS).find((d) =>
        annotation.description?.startsWith(`${d.id} `),
      );
      if (!defect) continue;
      const entry = this.defects.get(defect.id) ?? { defect, sightings: [] };
      entry.sightings.push(`${test.title} (${result.status})`);
      this.defects.set(defect.id, entry);
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const { ingestUrl, apiKey } = env.dashboard;
    if (!ingestUrl || !apiKey) return;

    const payload = {
      generatedAt: new Date().toISOString(),
      environment: env.testEnv,
      run: {
        totalTests: this.total,
        passed: this.passed,
        failed: this.failed,
        skipped: this.skipped,
        durationMs: Math.max(0, Date.now() - this.startedAt),
      },
      defects: [...this.defects.values()].map(({ defect, sightings }) => ({
        id: defect.id,
        displayId: defect.id,
        title: defect.summary,
        severity: defect.severity,
        module: defect.module,
        owner: '',
        method: '',
        endpointPath: '',
        description: defect.evidence,
        requestBody: '',
        expected: defect.expected,
        actual: `Observed by ${sightings.length} test(s) in this ${result.status} run: ${sightings.join('; ')}`,
      })),
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

      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          runId?: number;
          inserted?: number;
          updated?: number;
        };
        console.info(
          `[dashboard] run posted: runId=${body.runId} defects inserted=${body.inserted} updated=${body.updated} ` +
            `(${this.passed} passed / ${this.failed} failed / ${this.skipped} skipped)`,
        );
      } else {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        console.warn(`[dashboard] ingest rejected the run: HTTP ${response.status} ${detail}`);
      }
    } catch (error) {
      // Never fail the suite over reporting — the html/json/junit reports
      // already captured everything locally.
      console.warn(
        `[dashboard] could not reach ${ingestUrl}: ${(error as Error).message}. ` +
          'The run is still recorded in playwright-report/ and test-results/.',
      );
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}
