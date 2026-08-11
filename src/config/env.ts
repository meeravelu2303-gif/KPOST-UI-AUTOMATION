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

/** Reads a required env var and fails loudly at startup if it is missing. */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
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
      email: required('STANDARD_USER_EMAIL', 'standard.user@kpost.test'),
      password: required('STANDARD_USER_PASSWORD', 'Str0ng-Passw0rd!'),
    },
    admin: {
      email: required('ADMIN_USER_EMAIL', 'admin.user@kpost.test'),
      password: required('ADMIN_USER_PASSWORD', 'Str0ng-Admin-Passw0rd!'),
    },
  },
});
