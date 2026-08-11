/**
 * Profile — view, update, and validation.
 *
 * Runs authenticated (default fixture). The update path is verified against a
 * mocked PATCH so the test is deterministic and leaves no persisted change that
 * could leak into other tests.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { faker } from '@faker-js/faker';

test.describe('Profile @regression @profile', () => {
  test('renders the profile for the signed-in user', async ({ profilePage }) => {
    await profilePage.open();
    await profilePage.expectLoaded();
  });

  test('a user can update their display name', async ({ page, profilePage }) => {
    const newName = `QA ${faker.person.firstName()}`;
    let patched = false;

    await page.route(/\/api\/(users\/)?(me|profile)/i, async (route) => {
      if (['PATCH', 'PUT'].includes(route.request().method())) {
        patched = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ displayName: newName }),
        });
      } else {
        await route.fallback();
      }
    });

    await profilePage.open();
    await profilePage.expectLoaded();

    await profilePage.updateDisplayName(newName);
    await profilePage.save();

    expect(patched).toBe(true);
  });

  test('shows a validation error when the display name is cleared', async ({ profilePage }) => {
    await profilePage.open();
    await profilePage.expectLoaded();
    await profilePage.expectDisplayNameRequired();
  });
});
