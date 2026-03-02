/**
 * Auth guard utilities for service layer.
 * 
 * Provides defense-in-depth: even though Firestore rules enforce auth,
 * these checks catch issues early with clear error messages.
 */

import { auth } from '../lib/firebase';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Assert that a user is currently authenticated.
 * Throws AuthError if not.
 * 
 * @example
 * ```ts
 * async function addProduct(product: Product) {
 *   assertAuth();
 *   // proceed with Firestore write...
 * }
 * ```
 */
export function assertAuth(): void {
  if (!auth.currentUser) {
    throw new AuthError('Необходима аутентификация. Войдите в систему.');
  }
}

/**
 * Get the current user's email (lowercase) or throw if not authenticated.
 */
export function getCurrentUserEmail(): string {
  assertAuth();
  const email = auth.currentUser!.email?.toLowerCase();
  if (!email) {
    throw new AuthError('У текущего пользователя отсутствует email.');
  }
  return email;
}

/**
 * Get the current user's UID or throw if not authenticated.
 */
export function getCurrentUserId(): string {
  assertAuth();
  return auth.currentUser!.uid;
}
