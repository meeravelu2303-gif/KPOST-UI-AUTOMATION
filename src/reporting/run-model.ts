/**
 * The run model — one description of a finished run, built once, read by everyone.
 *
 * `BUG_REPORT.json`, `BUG_REPORT.md`, `DEV_DIGEST.md` and the QA-Dashboard payload
 * are all projections of this object. That is the whole point: the API bench keeps
 * its file reports and its dashboard push in separate reporters and has to document
 * an ordering constraint to stop them describing different runs. Deriving all four
 * from one in-memory model dissolves the constraint instead of managing it — they
 * cannot disagree, because there is only one set of numbers.
 *
 * This module is pure: it takes counts and sightings and returns an object. All
 * file writing lives in `bug-report.ts` / `dev-digest.ts`, and all network access in
 * `dashboard-reporter.ts`.
 *
 * ## On honesty
 *
 * `totalTests` is what Playwright PLANNED to run (`suite.allTests().length`), never
 * the number that happened to finish. When a run is cut short — the app fell over,
 * someone hit Ctrl-C, a global timeout fired — the planned total stays 236 while the
 * outcome counts stay at whatever genuinely happened. The gap between them IS the
 * signal, and `incomplete` names it. Nothing here rescales, back-fills or rounds a
 * count to close that gap.
 */
import type { KnownDefect } from '../utils/known-defects';

/** One test's observation of a known defect. */
export interface DefectSighting {
  readonly testTitle: string;
  readonly project: string;
  /** Playwright's terminal status for that test: passed / failed / timedOut / … */
  readonly status: string;
}

/** A defect as reported, shaped to the dashboard's ingest contract. */
export interface DefectRecord {
  readonly id: string;
  readonly displayId: string;
  readonly title: string;
  readonly severity: string;
  readonly module: string;
  readonly owner: string;
  readonly method: string;
  readonly endpointPath: string;
  readonly description: string;
  readonly requestBody: string;
  readonly expected: string;
  readonly actual: string;
}

export interface RunTotals {
  /** Tests Playwright planned to run — projects included. Never adjusted. */
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /**
   * Tests that began but were cut off before reaching a terminal result. Kept out
   * of passed/failed/skipped on purpose: an interrupted test did not pass, did not
   * fail, and was not skipped — claiming otherwise would be the lie this bench
   * exists to avoid.
   */
  readonly interrupted: number;
  /** passed + failed + skipped — what the dashboard's consistency check sums. */
  readonly accounted: number;
  /** totalTests − accounted. Zero on a healthy run. */
  readonly unaccounted: number;
  readonly durationMs: number;
  readonly durationSeconds: number;
}

export interface RunModel {
  /** ISO-8601 — what the dashboard ingests. */
  readonly generatedAt: string;
  /** `YYYY-MM-DD HH:MM:SS UTC` — what a human reads in the report headers. */
  readonly generatedAtHuman: string;
  /** Short code: Local / QA / Staging / Production / Unknown. Never a URL. */
  readonly environment: string;
  readonly baseURL: string;
  readonly run: RunTotals & {
    /** Playwright's own verdict: passed / failed / timedout / interrupted. */
    readonly status: string;
    readonly projects: readonly string[];
    /** True when the run did not account for everything it planned. */
    readonly incomplete: boolean;
    /** Why, in plain sentences. Empty on a complete run. */
    readonly incompleteReasons: readonly string[];
  };
  readonly summary: {
    readonly total: number;
    readonly bySeverity: Record<string, number>;
    readonly byModule: Record<string, number>;
  };
  readonly defects: readonly DefectRecord[];
}

export interface BuildRunModelInput {
  readonly status: string;
  readonly environment: string;
  readonly baseURL: string;
  /** `suite.allTests().length` — the planned total. */
  readonly totalTests: number;
  readonly projects: readonly string[];
  readonly durationMs: number;
  /** Terminal status per test that actually ended, keyed by test id. */
  readonly outcomes: ReadonlyMap<string, string>;
  /** Sightings per known defect, keyed by defect id. */
  readonly sightings: ReadonlyMap<string, { defect: KnownDefect; seen: DefectSighting[] }>;
}

/** Severity order used for sorting and for the digest's "look here first" list. */
export const SEVERITY_ORDER = ['High', 'Medium', 'Low'] as const;

export function severityRank(severity: string): number {
  const index = (SEVERITY_ORDER as readonly string[]).indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

export function buildRunModel(input: BuildRunModelInput): RunModel {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let interrupted = 0;

  /*
   * One vote per test, taken from its LAST attempt — not one per `onTestEnd`, which
   * fires once per retry and would count a flaky test twice (once red, once green).
   * A test that failed and then passed on retry is a passed test that cost time,
   * which is what Playwright's own `flaky` outcome means.
   */
  for (const status of input.outcomes.values()) {
    switch (status) {
      case 'passed':
        passed += 1;
        break;
      case 'failed':
      case 'timedOut':
        failed += 1;
        break;
      case 'skipped':
        skipped += 1;
        break;
      case 'interrupted':
        interrupted += 1;
        break;
      default:
        // An unrecognised status is still a test that did not pass. Counting it as
        // failed is the conservative reading; silently dropping it would shrink the
        // accounted total and misreport the run as more complete than it was.
        failed += 1;
    }
  }

  const accounted = passed + failed + skipped;
  const unaccounted = Math.max(0, input.totalTests - accounted);

  const incompleteReasons: string[] = [];
  if (input.status === 'interrupted' || input.status === 'timedout') {
    incompleteReasons.push(
      `Playwright ended the run with status "${input.status}" — it stopped before working ` +
        'through the plan.',
    );
  }
  if (unaccounted > 0) {
    incompleteReasons.push(
      `${accounted} of ${input.totalTests} planned tests reached a result; ${unaccounted} ` +
        'never produced one.',
    );
  }
  if (interrupted > 0) {
    incompleteReasons.push(`${interrupted} test(s) began but were cut off mid-flight.`);
  }

  const defects = [...input.sightings.values()]
    .map(({ defect, seen }) => toDefectRecord(defect, seen, input.status))
    .sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id),
    );

  return {
    generatedAt: new Date().toISOString(),
    generatedAtHuman: `${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    environment: input.environment,
    baseURL: input.baseURL,
    run: {
      status: input.status,
      totalTests: input.totalTests,
      passed,
      failed,
      skipped,
      interrupted,
      accounted,
      unaccounted,
      durationMs: Math.max(0, input.durationMs),
      durationSeconds: Math.round(Math.max(0, input.durationMs) / 100) / 10,
      projects: [...input.projects],
      incomplete: incompleteReasons.length > 0,
      incompleteReasons,
    },
    summary: {
      total: defects.length,
      bySeverity: tally(defects.map((d) => d.severity)),
      byModule: tally(defects.map((d) => d.module)),
    },
    defects,
  };
}

/**
 * Maps a registry entry plus its sightings onto the dashboard's defect contract.
 *
 * `method` / `endpointPath` / `requestBody` stay empty: they are the API bench's
 * vocabulary and a UI defect has no endpoint to name. Inventing one to fill the
 * column would put fiction in a bug ticket.
 */
function toDefectRecord(
  defect: KnownDefect,
  seen: readonly DefectSighting[],
  runStatus: string,
): DefectRecord {
  const witnesses = seen
    .map((s) => `${s.testTitle} [${s.project}] (${s.status})`)
    .join('; ');

  return {
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
    actual: `Observed by ${seen.length} test(s) in this ${runStatus} run: ${witnesses}`,
  };
}

function tally(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/** Pass rate over tests that actually produced a pass/fail. Null when none did. */
export function passRate(model: RunModel): number | null {
  const executed = model.run.passed + model.run.failed;
  if (executed === 0) return null;
  return Math.round((model.run.passed / executed) * 1000) / 10;
}

/**
 * The one-line verdict shared by every artifact.
 *
 * `BUG_REPORT.md`, `DEV_DIGEST.md` and the terminal all print this exact string —
 * a digest that grades a run differently from the report it summarises is worse
 * than no digest, because the two end up quoted against each other in the same
 * thread.
 */
export function verdict(model: RunModel): string {
  if (model.run.incomplete) {
    return (
      `INCOMPLETE RUN — ${model.run.accounted} of ${model.run.totalTests} planned tests ` +
      'reached a result. These numbers describe a truncated run, not a healthy one; ' +
      'do not read the pass rate as coverage.'
    );
  }
  const high = model.summary.bySeverity.High ?? 0;
  if (high > 0) {
    return `${high} high-severity application defect(s) open — fix before the next release.`;
  }
  if (model.run.failed > 0) {
    return `${model.run.failed} test(s) failed with no known defect attached — triage required.`;
  }
  return 'Clean run — every planned test reached a result and none failed.';
}
