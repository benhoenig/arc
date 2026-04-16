import type { z } from 'zod';

/**
 * Discriminated union returned by every Server Action.
 * Callers narrow on `result.ok` and handle each error case explicitly.
 * Per CONVENTIONS.md §7.2 — no exceptions cross the server/client boundary.
 */
export type ActionResult<TData = void> =
  | { ok: true; data: TData }
  | { ok: false; error: 'validation'; issues: z.core.$ZodIssue[] }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'conflict'; message?: string }
  | { ok: false; error: 'server' };
