/**
 * Logout journey.
 *
 * Uses the default authenticated fixture (shared storageState), so the test
 * starts already logged in and only needs to exercise the logout path and
 * verify the session is genuinely cleared.
 */
import { test, expect } from '../../src/fixtures/fixtures';

test.describe('Logout @regression @auth', () => {
  test('a signed-in user can log out and is returned to login', async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await dashboardPage.expectLoaded();

    await dashboardPage.logout();

    await expect(page).toHaveURL(/\/login/i);
  });

  test('after logout, protected routes redirect back to login', async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await dashboardPage.logout();

    // Attempting to revisit a protected route must not restore the session.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/i);
  });
});
