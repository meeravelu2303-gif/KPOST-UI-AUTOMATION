/**
 * Login journey — KPost two-step flow (ID → Submit → password → Login).
 *
 * These tests drive the *real* login flow, so they must run in a clean,
 * unauthenticated context. We override the shared authenticated storageState
 * for this whole file. Every test is atomic: navigate fresh, act, assert.
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

  test('the login flow advances from the ID step to the password step', async ({
    page,
    standardUser,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.expectLoaded();

    await loginPage.enterId(standardUser.email);
    await loginPage.submitId();

    await loginPage.expectPasswordStep();
  });
});

test.describe('Login — invalid credentials @regression @auth', () => {
  test('a valid ID with the wrong password does not authenticate', async ({ page, standardUser }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();

    await loginPage.attemptLogin(standardUser.email, 'definitely-the-wrong-password');

    await expect(page).not.toHaveURL(/\/home/i);
  });

  // Data-driven: one atomic test per invalid-ID scenario from the fixture.
  for (const scenario of invalidData.invalidIds) {
    test(`rejects login: ${scenario.description}`, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.open();
      await loginPage.attemptLogin(scenario.id, scenario.password);

      // However the app rejects it (step-1 or step-2), it must not authenticate.
      await expect(page).not.toHaveURL(/\/home/i);
    });
  }
});
