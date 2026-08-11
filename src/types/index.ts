/**
 * Shared domain types for the KPost automation framework.
 * Kept framework-agnostic so both UI page objects and (future) API helpers
 * can reuse the same models.
 */

export type UserRole = 'standard' | 'admin';

export interface User {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
}

export type PostVisibility = 'public' | 'followers' | 'private';

export interface Post {
  title: string;
  body: string;
  tags: string[];
  visibility: PostVisibility;
}

/** Shape of an in-app toast notification the UI surfaces to users. */
export interface Toast {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
