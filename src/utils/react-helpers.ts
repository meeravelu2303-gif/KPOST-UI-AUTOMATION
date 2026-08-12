/**
 * React-specific interaction helpers.
 *
 * React apps present unique timing challenges that generic Playwright
 * auto-waiting does not fully cover:
 *   - Re-renders after async state updates (the DOM node may be replaced).
 *   - Virtualized / windowed lists (react-window, react-virtualized) where
 *     only visible rows exist in the DOM.
 *   - Controlled inputs whose value is driven by state — a native fill can
 *     race the onChange handler and get "reverted".
 *
 * These helpers are intentionally framework-aware but locator-agnostic: they
 * take Playwright Locators/Pages so any page object can reuse them.
 */
import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Wait for the app to be render-ready after a navigation.
 *
 * Deliberately does NOT wait for `networkidle`. KPost never reaches it: the
 * shell continuously polls news feeds, Firebase, and websocket endpoints, so a
 * `networkidle` gate simply burns the navigation timeout and fails every test
 * that navigates (this was measured against the live app, not assumed).
 *
 * What remains is cheap and correct: the document is parsed, and two rAF ticks
 * give React a commit cycle to flush pending state into the DOM. Everything
 * beyond that is the job of the web-first assertions in `expectLoaded()`, which
 * auto-retry against the element the test actually cares about.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await assertAppCompiled(page);
  // Flush one React commit cycle.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** The iframe webpack-dev-server injects over the page when a build fails. */
const DEV_SERVER_OVERLAY = '#webpack-dev-server-client-overlay';

/**
 * Fail fast, and legibly, when the app under test does not compile.
 *
 * When the KPost dev server hits a build error it injects a full-page iframe
 * overlay. The server still answers 200, so from the suite's point of view the
 * app is "up" — but every locator then either times out ("element not found")
 * or is blocked ("<iframe id=webpack-dev-server-client-overlay> intercepts
 * pointer events"). Both readings send you hunting for a test bug that isn't
 * there; this has already cost two debugging sessions.
 *
 * So we detect the overlay, pull the compiler error out of it, and raise it as
 * the failure — turning a mystery timeout into "the app is broken, here's why".
 */
export async function assertAppCompiled(page: Page): Promise<void> {
  const overlay = page.locator(DEV_SERVER_OVERLAY);
  if (!(await overlay.isVisible().catch(() => false))) return;

  const detail = await page
    .frameLocator(DEV_SERVER_OVERLAY)
    .locator('body')
    .innerText()
    .catch(() => '');

  throw new Error(
    'The application under test failed to compile — the webpack dev-server error ' +
      'overlay is covering the page, so locators will time out or be intercepted. ' +
      'This is an app problem, not a test problem.\n\n' +
      (detail.trim().slice(0, 800) || '(overlay text could not be read)'),
  );
}

/**
 * Fill a controlled React input reliably.
 *
 * Controlled inputs re-render on every keystroke. `Locator.fill` sets the value
 * in one shot and dispatches a single input event, which most React onChange
 * handlers accept — but for inputs with debounced/validated state we verify the
 * committed value and fall back to sequential typing if React reverted it.
 */
export async function fillReactInput(locator: Locator, value: string): Promise<void> {
  await locator.waitFor({ state: 'visible' });
  await locator.fill('');
  await locator.fill(value);

  // Confirm React actually committed the value (guards against controlled
  // components that reset on re-render). If not, type character-by-character.
  const committed = await locator.inputValue();
  if (committed !== value) {
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 20 });
  }
  await expect(locator).toHaveValue(value);
}

/**
 * Interact with a custom (non-native) React select / combobox.
 *
 * Component libraries (MUI, react-select, Radix, Headless UI) render dropdowns
 * as portalled listboxes rather than a native <select>. This opens the trigger,
 * waits for the listbox to be visible, and clicks the option by its accessible
 * name — resilient to the underlying DOM structure.
 */
export async function selectCustomOption(
  page: Page,
  trigger: Locator,
  optionName: string | RegExp,
): Promise<void> {
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: optionName }).click();
  // The listbox should close after selection — wait it out to avoid races.
  await expect(listbox).toBeHidden();
}

/**
 * Scroll a virtualized list until an item with the given accessible name is
 * rendered, then return its locator.
 *
 * Virtualized lists only mount visible rows, so `scrollIntoViewIfNeeded` on a
 * not-yet-rendered item fails. We incrementally scroll the container and poll
 * until the target row mounts or we exhaust the attempt budget.
 */
export async function scrollVirtualizedListToItem(
  container: Locator,
  itemName: string | RegExp,
  maxScrolls = 30,
): Promise<Locator> {
  const item = container.getByText(itemName, { exact: false }).first();

  for (let i = 0; i < maxScrolls; i++) {
    if (await item.isVisible().catch(() => false)) {
      await item.scrollIntoViewIfNeeded();
      return item;
    }
    // Scroll the virtualized viewport by roughly one page.
    await container.evaluate((el) => el.scrollBy(0, el.clientHeight * 0.9));
    // Give react-window a tick to mount the newly-visible rows. This bounded
    // poll is the one legitimate place a short wait is unavoidable: a
    // virtualized row does not exist until scrolling mounts it, so there is no
    // element to auto-wait on yet.
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await container.page().waitForTimeout(100);
  }

  throw new Error(`Item "${itemName}" not found after ${maxScrolls} scroll attempts in virtualized list.`);
}

/**
 * Wait for a toast/notification with the expected text to appear, assert it,
 * then wait for it to auto-dismiss so it cannot leak into the next assertion.
 */
export async function expectToast(
  page: Page,
  message: string | RegExp,
  options: { role?: 'alert' | 'status'; dismiss?: boolean } = {},
): Promise<void> {
  const { role = 'status', dismiss = true } = options;
  const toast = page.getByRole(role).filter({ hasText: message });
  await expect(toast).toBeVisible();
  if (dismiss) {
    // Toasts typically auto-dismiss; wait for detachment so subsequent steps
    // aren't fooled by a lingering notification.
    await toast.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
      /* Non-auto-dismissing toast — leave it; the caller may close it. */
    });
  }
}
