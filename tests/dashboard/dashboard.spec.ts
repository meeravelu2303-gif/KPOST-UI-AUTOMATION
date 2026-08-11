/**
 * Dashboard UI validation and network-mocking examples.
 *
 * Demonstrates:
 *  - Asserting authenticated shell rendering.
 *  - Route interception to deterministically drive empty / populated / error
 *    feed states without depending on backend seed data (flake prevention).
 */
import { test, expect } from '../../src/fixtures/fixtures';
import { buildPosts } from '../../src/data/factories/postFactory';

test.describe('Dashboard shell @smoke', () => {
  test('renders the authenticated dashboard for a logged-in user', async ({ dashboardPage }) => {
    await dashboardPage.open();
    await dashboardPage.expectLoaded();
  });
});

test.describe('Dashboard feed states @regression', () => {
  test('shows the empty state when the feed has no posts', async ({ page, dashboardPage }) => {
    // Intercept the feed API and return zero posts — deterministic, no seed data.
    await page.route('**/api/posts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });

    await dashboardPage.open();
    await dashboardPage.expectLoaded();
    await dashboardPage.expectEmptyFeed();
  });

  test('renders posts returned by the feed API', async ({ page, dashboardPage }) => {
    const posts = buildPosts(3);
    await page.route('**/api/posts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: posts.map((p, i) => ({ id: `mock-${i}`, ...p })),
          total: posts.length,
        }),
      });
    });

    await dashboardPage.open();
    await dashboardPage.expectLoaded();

    for (const post of posts) {
      await dashboardPage.expectPostVisible(post.title);
    }
  });

  test('surfaces an error state when the feed API fails', async ({ page, dashboardPage }) => {
    await page.route('**/api/posts**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
    });

    await dashboardPage.open();
    await expect(page.getByRole('alert')).toContainText(/something went wrong|try again/i);
  });
});
