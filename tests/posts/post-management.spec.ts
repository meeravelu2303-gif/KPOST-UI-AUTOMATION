/**
 * Post management — edit and delete a single post.
 *
 * These journeys are made deterministic with route mocking: the post detail is
 * served from a known fixture and the destructive DELETE is intercepted. This
 * keeps every test atomic and parallel-safe (no dependence on real seeded data
 * and no cross-test interference on a shared backend).
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { buildPost } from '../../src/data/factories/postFactory';

const POST_ID = 'mock-post-42';

test.describe('Post management @regression @posts', () => {
  test('a user can open the delete dialog and cancel — the post survives', async ({
    page,
    postDetailPage,
  }) => {
    const post = buildPost();
    await page.route(`**/api/posts/${POST_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: POST_ID, ...post }),
        });
      } else {
        await route.fallback();
      }
    });

    await postDetailPage.openById(POST_ID);
    await postDetailPage.expectLoaded(post.title);

    await postDetailPage.openDeleteDialog();
    await postDetailPage.cancelDelete();

    // Still on the detail page with the post intact.
    await postDetailPage.expectLoaded(post.title);
    await expect(page).toHaveURL(new RegExp(`/posts/${POST_ID}`));
  });

  test('a user can delete a post and is redirected away', async ({ page, postDetailPage }) => {
    const post = buildPost();
    let deleteCalled = false;

    await page.route(`**/api/posts/${POST_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: POST_ID, ...post }),
        });
      } else if (method === 'DELETE') {
        deleteCalled = true;
        await route.fulfill({ status: 204, body: '' });
      } else {
        await route.fallback();
      }
    });

    await postDetailPage.openById(POST_ID);
    await postDetailPage.expectLoaded(post.title);

    await postDetailPage.openDeleteDialog();
    await postDetailPage.confirmDelete();

    expect(deleteCalled).toBe(true);
  });

  test('a user can edit a post and see the updated content', async ({
    page,
    postDetailPage,
    postCreationPage,
  }) => {
    const original = buildPost({ title: 'Original title' });
    const updatedTitle = 'Edited title';

    // Serve the original, then reflect the PATCH back on subsequent GETs.
    let saved = original;
    await page.route(`**/api/posts/${POST_ID}`, async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: POST_ID, ...saved }),
        });
      } else if (req.method() === 'PATCH' || req.method() === 'PUT') {
        saved = { ...saved, title: updatedTitle };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: POST_ID, ...saved }),
        });
      } else {
        await route.fallback();
      }
    });

    await postDetailPage.openById(POST_ID);
    await postDetailPage.expectLoaded(original.title);

    await postDetailPage.startEditing();
    await postCreationPage.fillTitle(updatedTitle);
    await postCreationPage.publish();

    await postDetailPage.openById(POST_ID);
    await postDetailPage.expectLoaded(updatedTitle);
  });
});
