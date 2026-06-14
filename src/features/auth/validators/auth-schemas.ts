import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(200),
  orgName: z.string().min(1).max(200),
});

// Error messages are i18n keys resolved in the form against
// `settings.account.password.errors`.
export const changePasswordSchema = z
  .object({
    // Better Auth verifies this against the stored hash; we only require non-empty.
    currentPassword: z.string().min(1, 'required'),
    // Match the signup minimum so the rule is consistent across the app.
    newPassword: z.string().min(8, 'tooShort'),
    confirmPassword: z.string().min(1, 'required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'samePassword',
    path: ['newPassword'],
  });
