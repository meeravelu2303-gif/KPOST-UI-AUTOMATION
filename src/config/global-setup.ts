/**
 * Global setup — runs once before the entire test run.
 *
 * Authenticates the standard test user a single time and persists the resulting
 * session (cookies + localStorage token) to disk. Tests then start already
 * logged-in by loading that storage state, which:
 *   - eliminates dozens of redundant, slow login flows,
 *   - removes login from the critical path of unrelated tests, and
 *   - keeps each test independent (they share auth *state*, not *runtime*).
 *
 * Two strategies, selected by `AUTH_MODE`:
 *   - 'api' (default) — POST to the API, then inject the returned token into
 *     localStorage and cookies into the context. Fast and deterministic.
 *   - 'ui'            — drive the real login form. Slower, but a good smoke of
 *     the auth path if the API contract isn't wired yet.
 *
 * Dedicated UI auth specs still exercise the login form regardless (they opt out
 * of this shared state). The `.auth/` dir is gitignored — never commit sessions.
 */
import { chromium, type Browser, type FullConfig } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { logger } from '../utils/logger';
import { apiLogin } from '../utils/api-helpers';

export const AUTH_DIR = path.resolve('.auth');
export const STANDARD_STORAGE_STATE = path.join(AUTH_DIR, 'standard.json');

async function seedViaApi(browser: Browser): Promise<void> {
  const { token, cookies } = await apiLogin(env.users.standard);

  const context = await browser.newContext({
    baseURL: env.baseURL,
    ignoreHTTPSErrors: true,
  });
  // Cookies from the API login (session-cookie auth).
  if (cookies.length > 0) await context.addCookies(cookies);

  // Token-based auth: seed localStorage before any app code runs so the SPA
  // boots already-authenticated on first navigation.
  if (token) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [env.auth.tokenStorageKey, token] as const,
    );
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.close();
  }

  await context.storageState({ path: STANDARD_STORAGE_STATE });
  await context.close();
}

async function seedViaUi(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    baseURL: env.baseURL,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).fill(env.users.standard.email);
  await page.getByLabel(/password/i).fill(env.users.standard.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/i, { timeout: 30_000 });
  await context.storageState({ path: STANDARD_STORAGE_STATE });
  await context.close();
}

async function globalSetup(_config: FullConfig): Promise<void> {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  logger.info(`Global setup: authenticating standard user (mode=${env.auth.mode})`);

  const browser = await chromium.launch(
    process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {},
  );
  try {
    if (env.auth.mode === 'api') {
      try {
        await seedViaApi(browser);
      } catch (apiError) {
        // If the API contract isn't wired up yet, fall back to the UI so the
        // suite still runs. Surface the reason so it's fixable.
        logger.warn('API auth failed; falling back to UI login', {
          error: (apiError as Error).message,
        });
        await seedViaUi(browser);
      }
    } else {
      await seedViaUi(browser);
    }
    logger.info(`Global setup: stored authenticated state at ${STANDARD_STORAGE_STATE}`);
  } catch (error) {
    logger.error('Global setup failed to authenticate. Is the KPost app running and seeded?', {
      baseURL: env.baseURL,
      apiBaseURL: env.apiBaseURL,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
