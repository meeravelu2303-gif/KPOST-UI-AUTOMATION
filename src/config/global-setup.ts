/**
 * Global setup — runs once before the entire test run.
 *
 * Authenticates the standard test user through the real UI a single time and
 * persists the resulting session (cookies + localStorage) to disk. Tests then
 * start already-logged-in by loading that storage state, which:
 *   - eliminates dozens of redundant, slow login flows,
 *   - removes login from the critical path of unrelated tests, and
 *   - keeps each test independent (they share auth *state*, not *runtime*).
 *
 * Tests that specifically verify login/logout use a fresh, unauthenticated
 * context instead (see the `login.spec.ts` and fixtures).
 */
import { chromium, type FullConfig } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { logger } from '../utils/logger';

export const AUTH_DIR = path.resolve('.auth');
export const STANDARD_STORAGE_STATE = path.join(AUTH_DIR, 'standard.json');

async function globalSetup(_config: FullConfig): Promise<void> {
  await fs.mkdir(AUTH_DIR, { recursive: true });

  logger.info('Global setup: authenticating standard user for shared storage state');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: env.baseURL,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.getByLabel(/email/i).fill(env.users.standard.email);
    await page.getByLabel(/password/i).fill(env.users.standard.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for authenticated landing so the session cookie/token is set.
    await page.waitForURL(/\/dashboard/i, { timeout: 30_000 });

    await context.storageState({ path: STANDARD_STORAGE_STATE });
    logger.info(`Global setup: stored authenticated state at ${STANDARD_STORAGE_STATE}`);
  } catch (error) {
    logger.error('Global setup failed to authenticate. Is the KPost app running and seeded?', {
      baseURL: env.baseURL,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
