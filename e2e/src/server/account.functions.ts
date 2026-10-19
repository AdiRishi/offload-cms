import {
  changePasswordInput,
  forgotPasswordInput,
  logInInput,
  resetPasswordInput,
  signUpInput,
  verifyEmailInput,
} from "@adirishi/offload-accounts";
import { getBindings } from "@adirishi/offload-cloudflare";
import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { accounts } from "@/lib/accounts.server";

/** The logged-in customer for the header and the account pages, or `null`. */
export const getAccount = createServerFn({ method: "GET" })
  .middleware([hideServerErrors])
  .handler(async () => {
    const account = await accounts.getAccount();
    return account && { id: account.id, email: account.email, name: account.name };
  });

export const logIn = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(logInInput)
  .handler(({ data }) => accounts.logIn(data));

export const logOut = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(z.object({ everywhere: z.boolean().optional() }))
  .handler(({ data }) => accounts.logOut(data));

export const signUp = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(signUpInput)
  .handler(async ({ data }) => {
    const env = await getBindings();
    return accounts.signUp(data, { turnstileSecret: env.TURNSTILE_SECRET_KEY });
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(forgotPasswordInput)
  .handler(async ({ data }) => {
    const env = await getBindings();
    return accounts.requestPasswordReset(data, { turnstileSecret: env.TURNSTILE_SECRET_KEY });
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(resetPasswordInput)
  .handler(({ data }) => accounts.resetPassword(data));

export const verifyEmail = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(verifyEmailInput)
  .handler(({ data }) => accounts.verifyEmail(data));

export const changePassword = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(changePasswordInput)
  .handler(({ data }) => accounts.changePassword(data));
