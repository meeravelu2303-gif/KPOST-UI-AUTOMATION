/**
 * Post creation journeys — happy path, validation, and edge cases.
 *
 * Every test builds its own unique post via the factory, so tests can run fully
 * in parallel against a shared backend with zero collisions or state leakage.
 * The default authenticated fixture means each test starts logged in.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { buildPost, buildMaxLengthTitlePost } from '../../src/data/factories/postFactory';
import boundaries from '../../src/data/posts.json';

test.describe('Post creation — happy path @smoke @posts', () => {
  test('a user can publish a public post end-to-end', async ({ dashboardPage, postCreationPage }) => {
    const post = buildPost({ visibility: 'public' });

    await dashboardPage.open();
    await dashboardPage.goToCreatePost();
    await postCreationPage.expectLoaded();

    await postCreationPage.composePost(post);
    await postCreationPage.publish();

    // The new post should appear in the feed (verifying the full round-trip).
    await dashboardPage.open();
    await dashboardPage.expectPostVisible(post.title);
  });

  test('a user can publish a followers-only post with tags', async ({
    dashboardPage,
    postCreationPage,
  }) => {
    const post = buildPost({ visibility: 'followers', tags: ['qa', 'automation', 'playwright'] });

    await dashboardPage.open();
    await dashboardPage.goToCreatePost();
    await postCreationPage.composePost(post);
    await postCreationPage.publish();
  });
});

test.describe('Post creation — validation & edge cases @regression @posts', () => {
  test('publish is blocked and an error shows when the title is empty', async ({
    postCreationPage,
  }) => {
    await postCreationPage.open();
    await postCreationPage.expectLoaded();

    // Fill only the body; leave the title blank.
    await postCreationPage.fillBody('Body without a title should not publish.');

    // Either the button is disabled, or clicking surfaces the required error.
    await postCreationPage.publish().catch(() => {
      /* publish() waits for a success response that will never come; ignore. */
    });
    await postCreationPage.expectTitleRequiredError();
  });

  test('accepts a title exactly at the maximum length boundary', async ({
    dashboardPage,
    postCreationPage,
  }) => {
    const post = buildMaxLengthTitlePost(boundaries.boundaries.maxTitleLength, { tags: [] });

    await dashboardPage.open();
    await dashboardPage.goToCreatePost();
    await postCreationPage.composePost(post);
    await postCreationPage.publish();
  });

  test('surfaces a server error toast when the create API fails', async ({
    page,
    dashboardPage,
    postCreationPage,
  }) => {
    // Force the create endpoint to fail — verifies graceful error handling.
    await page.route('**/api/posts', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server"}' });
      } else {
        await route.fallback();
      }
    });

    const post = buildPost();
    await dashboardPage.open();
    await dashboardPage.goToCreatePost();
    await postCreationPage.composePost(post);

    // Click publish (don't await the success helper) and assert the error toast.
    await page.getByRole('button', { name: /publish|post/i }).click();
    await expect(page.getByRole('alert')).toContainText(/couldn.?t publish|something went wrong|try again/i);
  });
});
