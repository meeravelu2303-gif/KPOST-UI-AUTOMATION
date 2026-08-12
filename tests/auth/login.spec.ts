/**
 * Login journey — valid, invalid, and validation edge cases.
 *
 * These tests drive the *real* login flow, so they must run in a clean,
 * unauthenticated context. We override the shared authenticated storageState
 * for this whole file with `test.use({ storageState: undefined })`.
 *
 * Every test is atomic: it navigates fresh, acts, and asserts, with no reliance
 * on order or on state left by another test.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { HomePage } from '../../src/pages/HomePage';
import invalidData from '../../src/data/users.json';

// Run this file logged-out.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login @smoke @auth', () => {
  test('a standard user can log in with valid credentials', async ({ page, standardUser }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await loginPage.open();
    await loginPage.expectLoaded();

    await loginPage.loginExpectingSuccess(standardUser);

    await homePage.expectLoaded();
    await expect(page).toHaveURL(/\/home/i);
  });

  test('the submit button is disabled until the form is filled', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.expectLoaded();
    await loginPage.expectSubmitDisabled();
  });
});

test.describe('Login — invalid credentials @regression @auth', () => {
  // Data-driven: one atomic test per invalid-login scenario from the fixture.
  for (const scenario of invalidData.invalidLogins) {
    test(`rejects login: ${scenario.description}`, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.open();
      await loginPage.enterCredentials(scenario.email, scenario.password);

      // For empty/malformed inputs the app blocks submission with inline
      // validation; for wrong-but-well-formed credentials it calls the API and
      // shows an error banner. Both paths must surface the expected message and
      // must NOT navigate to the dashboard.
      // Deliberate branch: some scenarios (empty/malformed) disable submit via
      // inline validation and never reach the API; others (wrong credentials)
      // enable it and fail server-side. The assertion below is identical for
      // both, keeping the test single-purpose despite the branch.
      const submit = page.getByRole('button', { name: /sign in|log in/i });
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (await submit.isEnabled()) {
        await submit.click();
      }

      await loginPage.expectError(scenario.expectedError);
      await expect(page).not.toHaveURL(/\/home/i);
    });
  }
});
