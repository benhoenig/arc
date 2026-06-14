import 'server-only';

import type { ActionResult } from '@/types/common';

// Shared error mapper for the M6 payment actions. Throw `new Error('not_found')`
// or `new Error('conflict:<reason>')` inside a transaction; this converts it
// to the ActionResult shape. Anything else is a 500.
export function mapPaymentError(error: unknown, label: string): ActionResult<never> {
  if (error instanceof Error) {
    if (error.message === 'not_found') {
      return { ok: false, error: 'not_found' };
    }
    if (error.message === 'forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    if (error.message.startsWith('conflict:')) {
      return {
        ok: false,
        error: 'conflict',
        message: error.message.slice('conflict:'.length),
      };
    }
  }
  console.error(`${label} failed`, error);
  return { ok: false, error: 'server' };
}
