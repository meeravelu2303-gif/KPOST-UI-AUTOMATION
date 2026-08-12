/**
 * Logout journey.
 *
 * Uses the default authenticated fixture (shared storageState), so the test
 * starts already logged in on the KPost home shell and only needs to exercise
 * the logout path (a sidebar action) and verify the session is cleared.
 */
import { test, expect } from '../../src/fixtures/fixtures';

test.describe('Logout @regression @auth', () => {
  test('a signed-in user can log out and is returned to login', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await homePage.logout();

    await expect(page).toHaveURL(/\/login/i);
  });

  test('after logout, protected routes redirect back to login', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.logout();

    // Attempting to revisit a protected route must not restore the session.
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/i);
  });
});
