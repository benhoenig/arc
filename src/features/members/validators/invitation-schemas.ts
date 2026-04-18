import { z } from 'zod';

// Keep this in sync with the seeded role slugs in seed_organization_roles().
export const INVITABLE_ROLE_SLUGS = [
  'admin',
  'pm',
  'sourcing',
  'contractor_manager',
  'sales',
] as const;
export type InvitableRoleSlug = (typeof INVITABLE_ROLE_SLUGS)[number];

export const createInvitationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  roleSlug: z.enum(INVITABLE_ROLE_SLUGS),
});

export const revokeInvitationSchema = z.object({
  id: z.string().uuid(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  fullName: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
});

export const removeMemberSchema = z.object({
  userRoleId: z.string().uuid(),
});
