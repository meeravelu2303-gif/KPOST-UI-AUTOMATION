/**
 * Dashboard feed — search and pagination.
 *
 * Uses route interception keyed on query params so the same test can assert the
 * app requests the right page/search term and renders exactly what the API
 * returns — deterministic, fast, and independent of backend seed data.
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { buildPosts } from '../../src/data/factories/postFactory';

test.describe('Feed search & pagination @regression @dashboard', () => {
  test('typing a query filters the feed to matching posts', async ({ page, dashboardPage }) => {
    const matching = buildPosts(2, { title: 'Playwright release notes' });

    await page.route('**/api/posts**', async (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get('q') ?? url.searchParams.get('search');
      const items = q ? matching.map((p, i) => ({ id: `s-${i}`, ...p })) : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, total: items.length }),
      });
    });

    await dashboardPage.open();
    await dashboardPage.search('Playwright');

    await expect(page.getByRole('article')).toHaveCount(2);
    await dashboardPage.expectPostVisible('Playwright release notes');
  });

  test('paginating loads the next page of results', async ({ page, dashboardPage }) => {
    const pageOne = buildPosts(3, { title: 'Page one post' });
    const pageTwo = buildPosts(3, { title: 'Page two post' });

    await page.route('**/api/posts**', async (route) => {
      const url = new URL(route.request().url());
      const pageNum = Number(url.searchParams.get('page') ?? '1');
      const items = (pageNum >= 2 ? pageTwo : pageOne).map((p, i) => ({ id: `p${pageNum}-${i}`, ...p }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, total: 6, page: pageNum }),
      });
    });

    await dashboardPage.open();
    await dashboardPage.expectPostVisible('Page one post');

    await dashboardPage.goToNextPage();
    await dashboardPage.expectPostVisible('Page two post');
  });
});
