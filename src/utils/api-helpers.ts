/**
 * API helpers — talk to the KPost API directly for fast auth and data seeding.
 *
 * Why: driving the UI for every precondition (log in, create the post a test
 * needs to edit) is slow and flaky. The API is the fast, deterministic path for
 * *arranging* state; the UI test then only *acts and asserts* on the thing it
 * actually covers. Dedicated UI auth tests still exercise the real login form.
 *
 * Contract assumptions (override via env / adjust here to match the real API):
 *   POST {apiBaseURL}{AUTH_LOGIN_PATH}   body: { email, password }
 *        → 200 with a JSON token in one of the common shapes below, and/or a
 *          Set-Cookie session. Both are captured into the persisted state.
 */
import { type APIRequestContext, type Cookie, request as playwrightRequest } from '@playwright/test';
import { env, type Credentials } from '../config/env';
import { logger } from './logger';
import type { Post } from '../types';

export interface AuthResult {
  /** Bearer token, if the API is token-based (empty for pure-cookie auth). */
  token: string;
  /** Cookies the API set during login (empty for pure-token auth). */
  cookies: Cookie[];
}

/** Pull a token out of the common response shapes without assuming just one. */
function extractToken(body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const candidates = [
      b.token,
      b.accessToken,
      b.access_token,
      b.jwt,
      (b.data as Record<string, unknown> | undefined)?.token,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 0) return c;
    }
  }
  return '';
}

/**
 * Log in via the API and return the token + cookies. Creates a short-lived
 * request context, so it is safe to call from setup or from within a test.
 */
export async function apiLogin(credentials: Credentials): Promise<AuthResult> {
  const context = await playwrightRequest.newContext({
    baseURL: env.apiBaseURL,
    ignoreHTTPSErrors: true,
  });
  try {
    const response = await context.post(env.auth.loginPath, {
      data: { email: credentials.email, password: credentials.password },
    });
    if (!response.ok()) {
      throw new Error(`API login failed: ${response.status()} ${await response.text()}`);
    }
    const token = extractToken(await response.json().catch(() => ({})));
    const cookies = (await context.storageState()).cookies;
    logger.info('API login succeeded', { tokenBased: token !== '', cookieCount: cookies.length });
    return { token, cookies };
  } finally {
    await context.dispose();
  }
}

/**
 * Seed a post through the API so a test has something to view/edit/delete
 * without composing it via the UI first. Returns the created post's id.
 */
export async function apiCreatePost(auth: AuthResult, post: Post): Promise<string> {
  const context = await authedContext(auth);
  try {
    const response = await context.post('/posts', { data: post });
    if (!response.ok()) {
      throw new Error(`API create-post failed: ${response.status()} ${await response.text()}`);
    }
    const body = (await response.json()) as { id?: string; _id?: string };
    const id = body.id ?? body._id;
    if (!id) throw new Error('API create-post returned no id');
    return id;
  } finally {
    await context.dispose();
  }
}

/** Delete a seeded post in teardown so seeded data never leaks between runs. */
export async function apiDeletePost(auth: AuthResult, id: string): Promise<void> {
  const context = await authedContext(auth);
  try {
    await context.delete(`/posts/${id}`);
  } finally {
    await context.dispose();
  }
}

/** Build an API request context pre-loaded with the auth token + cookies. */
export async function authedContext(auth: AuthResult): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: env.apiBaseURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
    storageState: { cookies: auth.cookies, origins: [] },
  });
}
