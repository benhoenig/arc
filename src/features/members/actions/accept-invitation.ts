'use server';

import type { z } from 'zod';
import { db } from '@/server/db';
import { getSupabaseServerClient } from '@/server/supabase/server-client';
import type { ActionResult } from '@/types/common';
import { hashInviteToken } from '../lib/invite-token';
import { acceptInvitationSchema } from '../validators/invitation-schemas';

type AcceptErrorCode =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'email_mismatch'
  | 'already_member'
  | 'email_taken';

const KNOWN_ACCEPT_CODES: readonly AcceptErrorCode[] = [
  'not_found',
  'expired',
  'revoked',
  'already_accepted',
  'email_mismatch',
  'already_member',
];

/**
 * Consumes an invitation as a brand-new user:
 *  1. Look up the invitation (SECURITY DEFINER `get_invitation_by_hash`).
 *  2. Supabase sign-up with the invitation email — the auth.users-insert
 *     trigger populates public.users. signUp also establishes the session
 *     cookie so subsequent Supabase RPC calls carry the JWT.
 *  3. Call the SECURITY DEFINER `accept_invitation` via supabase.rpc so
 *     `auth.uid()` resolves. That function atomically updates the user's
 *     name, creates the user_roles row, marks the invitation accepted,
 *     and logs activity.
 *
 * Existing-user-joins-another-org is not supported here (they'd hit
 * `email_taken` on signUp). That flow becomes relevant once multi-org
 * session switching is built.
 */
export async function acceptInvitation(
  input: z.infer<typeof acceptInvitationSchema>,
): Promise<ActionResult<{ organizationId: string }>> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', issues: parsed.error.issues };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  const lookup = await db.$queryRaw<
    Array<{ invitation_id: string; organization_id: string; email: string }>
  >`SELECT invitation_id, organization_id, email FROM get_invitation_by_hash(${tokenHash})`;

  const row = lookup[0];
  if (!row) {
    return { ok: false, error: 'not_found' };
  }

  const supabase = await getSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: row.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered')) {
      return { ok: false, error: 'conflict', message: 'email_taken' satisfies AcceptErrorCode };
    }
    return { ok: false, error: 'server' };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('accept_invitation', {
    p_token_hash: tokenHash,
    p_full_name: parsed.data.fullName,
  });

  if (rpcError) {
    const matched = KNOWN_ACCEPT_CODES.find((code) => rpcError.message.includes(code));
    if (matched) {
      return { ok: false, error: 'conflict', message: matched };
    }
    console.error('acceptInvitation rpc failed', rpcError);
    return { ok: false, error: 'server' };
  }

  const organizationId = typeof rpcData === 'string' ? rpcData : row.organization_id;
  return { ok: true, data: { organizationId } };
}
