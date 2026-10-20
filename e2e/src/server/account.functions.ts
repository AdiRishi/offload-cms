import {
  changePasswordInput,
  forgotPasswordInput,
  logInInput,
  resetPasswordInput,
  signUpInput,
  verifyEmailInput,
} from "@adirishi/offload-accounts";
import { getBindings } from "@adirishi/offload-cloudflare";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { accounts } from "@/lib/accounts.server";

/** The logged-in customer for the header and the account pages, or `null`. */
export const getAccount = createServerFn({ method: "GET" }).handler(async () => {
  const account = await accounts.getAccount();
  return account && { id: account.id, email: account.email, name: account.name };
});

export const logIn = createServerFn({ method: "POST" })
  .validator(logInInput)
  .handler(({ data }) => accounts.logIn(data));

export const logOut = createServerFn({ method: "POST" })
  .validator(z.object({ everywhere: z.boolean().optional() }))
  .handler(({ data }) => accounts.logOut(data));

export const signUp = createServerFn({ method: "POST" })
  .validator(signUpInput)
  .handler(async ({ data }) => {
    const env = await getBindings();
    return accounts.signUp(data, { turnstileSecret: env.TURNSTILE_SECRET_KEY });
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(forgotPasswordInput)
  .handler(async ({ data }) => {
    const env = await getBindings();
    return accounts.requestPasswordReset(data, { turnstileSecret: env.TURNSTILE_SECRET_KEY });
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator(resetPasswordInput)
  .handler(({ data }) => accounts.resetPassword(data));

export const verifyEmail = createServerFn({ method: "POST" })
  .validator(verifyEmailInput)
  .handler(({ data }) => accounts.verifyEmail(data));

export const changePassword = createServerFn({ method: "POST" })
  .validator(changePasswordInput)
  .handler(({ data }) => accounts.changePassword(data));
