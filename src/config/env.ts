/**
 * Centralized, type-safe environment configuration.
 *
 * Reads from process.env (populated by dotenv in playwright.config.ts) and
 * exposes a single frozen `env` object. Keeping all environment access behind
 * this module means tests and page objects never touch process.env directly,
 * which makes them portable across local / dev / staging / CI.
 */
import { config as loadDotenv } from 'dotenv';

// Load `.env` if present. In CI, real values come from injected env vars,
// so a missing `.env` file is not an error.
loadDotenv();

type TestEnvironment = 'local' | 'dev' | 'staging' | 'prod';

/**
 * Reads a required env var and fails loudly at startup if it is missing.
 *
 * Deliberately takes no fallback: a credential that silently defaults to a
 * placeholder produces an opaque login timeout deep inside global setup instead
 * of a readable configuration error here.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy .env.example to .env or set it in your CI secrets.`,
    );
  }
  return value;
}

/** Reads an optional env var with a default. */
function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function toBool(value: string): boolean {
  return value.toLowerCase() === 'true' || value === '1';
}

function toIntOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Read an optional credential pair. Returns undefined when neither is set, and
 * throws when only one is — a half-configured account is a mistake worth
 * catching at startup rather than as a confusing login failure later.
 */
function optionalCredentials(emailVar: string, passwordVar: string): Credentials | undefined {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  const hasEmail = email !== undefined && email !== '';
  const hasPassword = password !== undefined && password !== '';

  if (!hasEmail && !hasPassword) return undefined;
  if (!hasEmail || !hasPassword) {
    throw new Error(
      `"${emailVar}" and "${passwordVar}" must be set together — found only ` +
        `${hasEmail ? emailVar : passwordVar}.`,
    );
  }
  return { email, password };
}

const directoryUser = optionalCredentials('DIRECTORY_USER_EMAIL', 'DIRECTORY_USER_PASSWORD');

/** Read the optional dashboard pair; both-or-neither, like credentials. */
function optionalDashboard(): { ingestUrl: string | undefined; apiKey: string | undefined } {
  const ingestUrl = process.env.DASHBOARD_INGEST_URL || undefined;
  const apiKey = process.env.DASHBOARD_API_KEY || undefined;
  if ((ingestUrl === undefined) !== (apiKey === undefined)) {
    throw new Error(
      '"DASHBOARD_INGEST_URL" and "DASHBOARD_API_KEY" must be set together — found only ' +
        `${ingestUrl ? 'DASHBOARD_INGEST_URL' : 'DASHBOARD_API_KEY'}.`,
    );
  }
  return { ingestUrl, apiKey };
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface EnvConfig {
  readonly testEnv: TestEnvironment;
  readonly baseURL: string;
  readonly apiBaseURL: string;
  readonly headless: boolean;
  readonly slowMo: number;
  readonly workers: number | undefined;
  readonly retries: number | undefined;
  readonly isCI: boolean;
  readonly users: {
    readonly standard: Credentials;
    readonly admin: Credentials;
    /**
     * OPTIONAL account that has already completed KDirectory onboarding.
     *
     * KDirectory's search, contact list, and filters sit behind a one-time
     * setup wizard, and completing it permanently onboards an account into a
     * vertical — so the shared standard user is deliberately left un-onboarded.
     * Set DIRECTORY_USER_EMAIL / DIRECTORY_USER_PASSWORD to point the gated
     * specs at a user that is already through it; leave unset and they skip
     * with a reason. Both variables must be set together.
     */
    readonly directory?: Credentials;
  };
  /** True when a pre-onboarded directory user is configured. */
  readonly hasDirectoryUser: boolean;
  readonly mail: {
    /**
     * OPTIONAL recipient for the KMail send E2E test. The backend rejects
     * sending to yourself ("Duplicate IDs are present in ToAddress, CopyList,
     * or ConfidentialCopyList" — the app auto-appends the sender), so the full
     * success path needs a second KPOST account. Unset → the send test verifies
     * the compose/send mechanics against that documented self-send rejection.
     */
    readonly recipient: string | undefined;
  };
  /**
   * OPTIONAL external QA dashboard (the separate QA-Dashboard repo). When both
   * values are set, `DashboardReporter` posts every run's summary and observed
   * known defects to `POST {ingestUrl}` with `Authorization: Bearer {apiKey}`.
   * Leave both unset and the reporter no-ops. Set only one and startup fails.
   */
  readonly dashboard: {
    readonly ingestUrl: string | undefined;
    readonly apiKey: string | undefined;
  };
  readonly auth: {
    /** 'api' → fast API login for storage state; 'ui' → drive the login form. */
    readonly mode: 'api' | 'ui';
    /** Login endpoint path, relative to apiBaseURL (POST email+password). */
    readonly loginPath: string;
    /** localStorage key the SPA reads the auth token from (token-based apps). */
    readonly tokenStorageKey: string;
  };
}

export const env: EnvConfig = Object.freeze({
  testEnv: optional('TEST_ENV', 'local') as TestEnvironment,
  baseURL: optional('BASE_URL', 'https://localhost:3000'),
  apiBaseURL: optional('API_BASE_URL', 'https://localhost:3000/api'),
  headless: toBool(optional('HEADLESS', 'true')),
  slowMo: Number.parseInt(optional('SLOW_MO', '0'), 10),
  workers: toIntOrUndefined(process.env.WORKERS),
  retries: toIntOrUndefined(process.env.RETRIES),
  isCI: toBool(optional('CI', 'false')),
  users: {
    standard: {
      email: required('STANDARD_USER_EMAIL'),
      password: required('STANDARD_USER_PASSWORD'),
    },
    admin: {
      email: required('ADMIN_USER_EMAIL'),
      password: required('ADMIN_USER_PASSWORD'),
    },
    ...(directoryUser ? { directory: directoryUser } : {}),
  },
  hasDirectoryUser: directoryUser !== undefined,
  mail: {
    recipient: process.env.MAIL_RECIPIENT || undefined,
  },
  dashboard: optionalDashboard(),
  auth: {
    // Defaults to 'ui': KPost stores its session as several localStorage keys
    // (accessToken, refreshToken, isAuthenticated, Authuser, and an encrypted
    // redux-persist blob), so a single injected API token is not enough to boot
    // the SPA authenticated. Set AUTH_MODE=api only once that contract is wired.
    mode: optional('AUTH_MODE', 'ui') as 'api' | 'ui',
    loginPath: optional('AUTH_LOGIN_PATH', '/auth/login'),
    tokenStorageKey: optional('AUTH_TOKEN_STORAGE_KEY', 'accessToken'),
  },
});
