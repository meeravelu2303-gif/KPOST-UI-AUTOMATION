/**
 * Custom Playwright fixtures — the composition root of the framework.
 *
 * This is where page objects are injected and session state is managed so that
 * individual spec files stay declarative: a test just asks for `loginPage` or
 * `dashboardPage` and receives a ready-to-use instance bound to the correct
 * (authenticated or anonymous) browser context.
 *
 * Two worlds are exposed:
 *   - `test`         → authenticated by default (loads the shared storageState),
 *                      for the bulk of the suite that assumes a logged-in user.
 *   - `test.use({ storageState: undefined })` on a describe block, or the
 *     `anonymousPage` fixture, gives a clean, logged-out context for auth tests.
 *
 * Import `test` and `expect` from here instead of `@playwright/test` throughout
 * the specs.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PostCreationPage } from '../pages/PostCreationPage';
import { PostDetailPage } from '../pages/PostDetailPage';
import { ProfilePage } from '../pages/ProfilePage';
import { STANDARD_STORAGE_STATE } from '../config/global-setup';
import { env, type Credentials } from '../config/env';
import { apiLogin, apiCreatePost, apiDeletePost, type AuthResult } from '../utils/api-helpers';
import type { Post } from '../types';

/** Test-scoped fixtures — recreated per test. */
interface KPostFixtures {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  postCreationPage: PostCreationPage;
  postDetailPage: PostDetailPage;
  profilePage: ProfilePage;
  /** A page in a fresh, unauthenticated context (for login/logout tests). */
  anonymousPage: Page;
  /** Convenience accessor for the seeded standard-user credentials. */
  standardUser: Credentials;
  adminUser: Credentials;
  /**
   * Seed a post via the API and get its id back. Every post seeded through this
   * fixture is automatically deleted in teardown, so tests stay atomic and
   * leave no residue in a shared backend.
   */
  seedPost: (post: Post) => Promise<string>;
}

/** Worker-scoped fixtures — created once per worker and reused across its tests. */
interface KPostWorkerFixtures {
  /** Standard-user API auth (token + cookies), obtained once per worker. */
  apiAuth: AuthResult;
}

export const test = base.extend<KPostFixtures, KPostWorkerFixtures>({
  /**
   * Authenticated context by default. `storageState` from global setup is
   * applied to every test's context unless a describe block overrides it.
   */
  storageState: STANDARD_STORAGE_STATE,

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  postCreationPage: async ({ page }, use) => {
    await use(new PostCreationPage(page));
  },

  postDetailPage: async ({ page }, use) => {
    await use(new PostDetailPage(page));
  },

  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },

  /**
   * A throwaway, logged-out page. Created in its own context so it never
   * inherits the shared authenticated storageState — essential for tests that
   * drive the real login flow. Automatically torn down after the test.
   */
  anonymousPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  standardUser: async ({}, use) => {
    await use(env.users.standard);
  },

  adminUser: async ({}, use) => {
    await use(env.users.admin);
  },

  // Worker-scoped: one API login per worker, shared by all its tests.
  apiAuth: [
    async ({}, use) => {
      const auth = await apiLogin(env.users.standard);
      await use(auth);
    },
    { scope: 'worker' },
  ],

  // Test-scoped: seed posts via the API and clean them up afterwards.
  seedPost: async ({ apiAuth }, use) => {
    const createdIds: string[] = [];
    const seed = async (post: Post): Promise<string> => {
      const id = await apiCreatePost(apiAuth, post);
      createdIds.push(id);
      return id;
    };
    await use(seed);
    // Teardown: best-effort delete so seeded data never leaks between tests.
    for (const id of createdIds) {
      await apiDeletePost(apiAuth, id).catch(() => undefined);
    }
  },
});

export { expect };
