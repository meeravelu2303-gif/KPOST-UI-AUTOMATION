/**
 * Preflight for the login form.
 *
 * KPost's login screen gained a **Country** step: `/login` now renders a
 * country combobox above the KPOST ID field, and the ID input is
 * `disabled={!country}` (Login.js). The app is meant to fill that combobox
 * itself — it fetches `/v2/common/countries` on mount and defaults to India —
 * so a healthy app needs no interaction here, and the flow stays
 * ID → password from the suite's point of view.
 *
 * When that fetch is not applied, the ID field simply stays disabled forever.
 * Playwright's own error for that is `element is not enabled`, repeated for 30
 * seconds, several layers away from the cause — and because global setup signs
 * in before anything else, it takes the entire run down with it.
 *
 * So both login paths (`LoginPage` for specs, `seedViaUi` for global setup)
 * funnel through `waitForLoginFormReady()`, which turns that timeout into a
 * named diagnosis: KPOST-AUTH-004, with the country list's own words as
 * evidence. Registry entry: `KNOWN_APP_DEFECTS.LOGIN_COUNTRY_LIST_NEVER_POPULATES`.
 */
import { type Locator, type Page } from '@playwright/test';
import { KNOWN_APP_DEFECTS } from './known-defects';

const DEFECT = KNOWN_APP_DEFECTS.LOGIN_COUNTRY_LIST_NEVER_POPULATES;

/**
 * The country combobox. `react-select` gives it `role="combobox"`, but the
 * page's language picker is a native `<select>` — also a combobox — and renders
 * first, hence `.last()` rather than a positional guess.
 */
export function countryCombobox(page: Page): Locator {
  return page.getByRole('combobox').last();
}

/** Whatever the country control is showing right now — a value, or its empty state. */
export async function countryStatusText(page: Page): Promise<string> {
  const field = page.locator('.login__field').filter({ hasText: /country/i }).first();
  const text = await field.innerText().catch(() => '');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Wait until the login form can actually be used, i.e. the KPOST ID field is
 * enabled. Throws a diagnosis naming KPOST-AUTH-004 when it never is.
 *
 * Deliberately free of `test.step()` so global setup can call it too — steps
 * are only legal inside a running test.
 */
export async function waitForLoginFormReady(
  page: Page,
  idInput: Locator,
  timeout: number,
): Promise<void> {
  const enabledIdInput = idInput.and(page.locator('input:enabled'));

  try {
    await enabledIdInput.waitFor({ state: 'visible', timeout });
  } catch {
    throw new Error(await describeBlockedLogin(page));
  }
}

/** The failure message: what was observed, what it means, and who fixes it. */
export async function describeBlockedLogin(page: Page): Promise<string> {
  const country = await countryStatusText(page);

  return (
    `KNOWN APPLICATION DEFECT ${DEFECT.id}: ${DEFECT.summary}\n` +
    `The KPOST ID field never became enabled. The country control reads: ` +
    `${country ? `"${country}"` : '(not rendered)'}.\n` +
    'The country list is what enables that field, and it is empty even though ' +
    'GET /v2/common/countries answers 200 with the full list — Login.js gates it on a ' +
    'case-sensitive `response.status === "SUCCESS"` while the backend answers "Success".\n' +
    'Nothing in this suite can proceed until a user can sign in, so this is reported here ' +
    'rather than as 300 identical timeouts. See src/utils/known-defects.ts for the full evidence.'
  );
}
