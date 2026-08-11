/**
 * Post lifecycle — arrange via API, act & assert via UI.
 *
 * This is the fast, deterministic pattern the framework favors for anything
 * that needs a *precondition*: the post under test is created through the API
 * (`seedPost`), so the test spends its time exercising the UI it actually
 * covers — viewing and deleting — not re-composing setup through the browser.
 * `seedPost` auto-deletes anything it created in teardown, keeping the run clean.
 *
 * Requires the live KPost app + API (BASE_URL / API_BASE_URL). Unlike the
 * route-mocked specs, it validates the real end-to-end round-trip.
 */
import { test } from '../../src/fixtures/fixtures';
import { buildPost } from '../../src/data/factories/postFactory';

test.describe('Post lifecycle (API-seeded) @regression @posts', () => {
  test('a seeded post is viewable in the UI', async ({ seedPost, postDetailPage }) => {
    const post = buildPost();
    const id = await seedPost(post); // fast API arrange

    await postDetailPage.openById(id);
    await postDetailPage.expectLoaded(post.title);
    await postDetailPage.expectBody(post.body);
  });

  test('a user can delete a seeded post from its detail page', async ({
    seedPost,
    postDetailPage,
    dashboardPage,
  }) => {
    const post = buildPost();
    const id = await seedPost(post);

    await postDetailPage.openById(id);
    await postDetailPage.openDeleteDialog();
    await postDetailPage.confirmDelete();

    // After deletion the post should no longer appear in the feed.
    await dashboardPage.open();
    await dashboardPage.expectLoaded();
  });
});
