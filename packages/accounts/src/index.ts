import { z } from "zod";

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "Enter a valid email address."));

const newPassword = z
  .string({ error: "Choose a password." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");

const turnstileToken = z.string().min(1).max(2048);

/** A path on the site to go to afterwards. The server falls back to the account page for one that leaves the site. */
const returnTo = z.string().max(2048).optional();

export const logInInput = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128, "Use at most 128 characters."),
  returnTo,
});

export const signUpInput = z.object({ email, password: newPassword, turnstileToken, returnTo });

export const forgotPasswordInput = z.object({ email, turnstileToken });

export const resetPasswordInput = z.object({
  token: z.string().min(1).max(512),
  password: newPassword,
});

export const verifyEmailInput = z.object({ token: z.string().min(1).max(512) });

export const changePasswordInput = z.object({
  currentPassword: z
    .string()
    .min(1, "Enter your current password.")
    .max(128, "Use at most 128 characters."),
  newPassword,
});

export type LogInInput = z.infer<typeof logInInput>;
export type SignUpInput = z.infer<typeof signUpInput>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInput>;
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

/**
 * `invalid` covers an unknown email and a wrong password alike. `email-unverified` comes only
 * after a correct password. `locked` needs the collection's lockout, which is off by default.
 */
export type LogInResult =
  | { status: "signed-in"; returnTo: string }
  | { status: "invalid" | "email-unverified" | "locked" | "limited" | "error" };

/**
 * `check-email` is the answer for a new account that must verify its email and for an email that
 * already has an account, so the answer never shows which emails are registered. `unverified`
 * means the Turnstile check failed.
 */
export type SignUpResult =
  | { status: "signed-in"; returnTo: string }
  | { status: "check-email" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "unverified" | "error" };

/** `sent` whether or not the email has an account. */
export type ForgotPasswordResult = { status: "sent" | "unverified" | "limited" | "error" };

/** `invalid` for a link that expired or was already used. */
export type ResetPasswordResult =
  | { status: "signed-in"; returnTo: string }
  | { status: "invalid" | "error" };

/** `invalid` for a link that was already used or never existed. */
export type VerifyEmailResult = { status: "verified" | "invalid" | "error" };

/**
 * `invalid` for a wrong current password, and `signed-out` when the visitor's session ended first.
 * `limited` comes from the login rate limit, which the current password check shares.
 */
export type ChangePasswordResult = {
  status: "changed" | "invalid" | "limited" | "signed-out" | "error";
};
