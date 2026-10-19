import type {
  Access,
  CollectionBeforeOperationHook,
  CollectionConfig,
  Endpoint,
  IncomingAuthType,
  PayloadRequest,
  User,
} from "payload";

import { APIError } from "payload";

import { signUpAttempt } from "./context.ts";

/** A Workers Rate Limiting binding, or anything with its `limit()` method. */
export type RateLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

export type AccountEmail = { subject: string; html: string };

type EmailTemplate<TArgs> = (
  args: TArgs & { user: User; req: PayloadRequest },
) => AccountEmail | Promise<AccountEmail>;

export type AccountOptions = {
  /**
   * The site's public origin, such as `https://example.com`. The links in account emails start
   * with it, so a request's Host header never decides where they point.
   */
  siteURL: string;
  /**
   * The Rate Limiting binding for logins and password reset requests. A function, because
   * Cloudflare's upload validation loads the config without bindings.
   */
  rateLimit: () => RateLimiter;
  /**
   * Whether an account must verify its email before it can log in. Default `true`. Without
   * verification, sign-up logs a new account in at once, so its answer shows which emails are new.
   */
  verify?: boolean;
  /** The site's account pages that emails link to. */
  paths?: { logIn?: string; resetPassword?: string; verifyEmail?: string };
  /** Replace the default emails. Each receives the link to put in the email. */
  emails?: {
    verifyEmail?: EmailTemplate<{ url: string }>;
    /**
     * Sent for a password reset request, and when someone signs up with an email that already
     * has an account. `logInURL` is set only for a sign-up, so the email can say which happened.
     */
    resetPassword?: EmailTemplate<{ url: string; logInURL?: string }>;
  };
};

type ForgotPasswordSettings = Omit<
  NonNullable<IncomingAuthType["forgotPassword"]>,
  "generateEmailHTML" | "generateEmailSubject"
>;

/** A collection config for `accountCollection()`. Verification and the emails come from its options. */
export type AccountCollectionConfig = Omit<CollectionConfig, "auth"> & {
  auth?: Omit<IncomingAuthType, "verify" | "forgotPassword"> & {
    forgotPassword?: ForgotPasswordSettings;
  };
};

/** True for a user of the admin's auth collection, `admin.user` in the Payload config. */
export const isAdminUser: Access = ({ req }) =>
  req.user?.collection === req.payload.config.admin.user;

/**
 * Access for documents that belong to an account: users of the admin's collection reach every
 * document, and a user of `accounts` reaches the documents whose `field` is that user.
 */
export const adminOrOwner =
  (accounts: string, field: string): Access =>
  ({ req }) => {
    if (req.user?.collection === req.payload.config.admin.user) return true;
    if (req.user?.collection !== accounts) return false;
    return { [field]: { equals: req.user.id } };
  };

const adminOrSelf =
  (accounts: string): Access =>
  ({ req }) => {
    if (req.user?.collection === req.payload.config.admin.user) return true;
    if (req.user?.collection !== accounts) return false;
    return { id: { equals: req.user.id } };
  };

const rateLimitHook =
  (slug: string, rateLimit: () => RateLimiter): CollectionBeforeOperationHook =>
  async ({ args, operation, req }) => {
    if (operation !== "login" && operation !== "forgotPassword") return args;
    const email = args.data.email?.trim().toLowerCase();
    const ip = req.headers.get("cf-connecting-ip");
    const action = operation === "login" ? "login" : "forgot-password";
    const keys = [
      ...(ip ? [`${slug}:${action}:ip:${ip}`] : []),
      ...(email ? [`${slug}:${action}:email:${email}`] : []),
    ];
    const binding = rateLimit();
    const outcomes = await Promise.all(keys.map((key) => binding.limit({ key })));
    if (outcomes.some(({ success }) => !success)) {
      throw new APIError("Too many attempts. Wait a minute and try again.", 429, null, true);
    }
    return args;
  };

/**
 * Payload lets a user who may update their own document change its email and password through
 * REST, with no current password and without verifying the new email. A stolen session could then
 * keep the account. Only the admin's users, and server code with `overrideAccess`, may change them.
 */
const protectCredentials: CollectionBeforeOperationHook = ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== "update" || overrideAccess) return args;
  if (req.user?.collection === req.payload.config.admin.user) return args;
  const { data } = args;
  const changesEmail =
    typeof data.email === "string" && data.email.trim().toLowerCase() !== req.user?.email;
  if (changesEmail || "password" in data) {
    throw new APIError(
      "Only an admin can change an account's email or password here.",
      403,
      null,
      true,
    );
  }
  return args;
};

/**
 * Payload gives every auth collection `POST /first-register`, which creates the first document of
 * an empty collection with access control bypassed and marks it verified. A collection endpoint
 * comes before the auth endpoints, so this one answers instead.
 */
const refuseFirstRegister: Endpoint = {
  path: "/first-register",
  method: "post",
  handler: () =>
    Response.json(
      { errors: [{ message: "Accounts are created through sign-up or by an admin." }] },
      { status: 403 },
    ),
};

const link = (siteURL: string, path: string, token?: string) => {
  const url = new URL(path, siteURL);
  if (token) url.searchParams.set("token", token);
  return url.href;
};

const defaultVerifyEmail: EmailTemplate<{ url: string }> = ({ url }) => ({
  subject: "Confirm your email address",
  html: `<p>Confirm your email address to finish creating your account.</p>
<p><a href="${url}">Confirm your email address</a></p>
<p>If you didn't create an account, ignore this email.</p>`,
});

const defaultResetPassword =
  (minutes: number): EmailTemplate<{ url: string; logInURL?: string }> =>
  ({ url, logInURL }) =>
    logInURL
      ? {
          subject: "You already have an account",
          html: `<p>Someone tried to create an account with this email address, but it already has one.</p>
<p>To use your account, <a href="${logInURL}">log in</a>. If you forgot your password, choose a new one. The link works once, for ${minutes} minutes.</p>
<p><a href="${url}">Choose a new password</a></p>
<p>If this wasn't you, ignore this email.</p>`,
        }
      : {
          subject: "Reset your password",
          html: `<p>Someone asked to reset the password for your account. Choose a new password with this link. It works once, for ${minutes} minutes.</p>
<p><a href="${url}">Choose a new password</a></p>
<p>If you didn't ask, ignore this email. Your password stays the same.</p>`,
        };

/**
 * An auth collection for the site's visitors, such as customers or members. On top of the
 * collection it receives, it sets:
 *
 * - Sessions that last 14 days, which `createAccountHelpers()` extends while the visitor is active.
 * - A `Secure`, `SameSite=Lax` cookie, and no lockout after failed logins.
 * - A rate limit on logins and password reset requests, per visitor IP and per email, that covers
 *   the REST endpoints too.
 * - Email verification, unless `verify` is `false`, and emails that link to the site's pages.
 * - `POST /first-register` answering 403, so the empty collection can't get its first account
 *   past access control.
 * - Access that lets only the admin's users create and delete accounts, and lets an account read
 *   and update only itself. An account can't change its own email or password through REST.
 *   `createAccountHelpers()` changes the password after checking the current one, and only the
 *   admin's users change an email.
 *
 * The collection's own `auth`, `access`, and `admin` settings override these, and its
 * `beforeOperation` hooks run after the rate limit.
 */
export const accountCollection = (
  { auth, access, admin, hooks, endpoints, ...collection }: AccountCollectionConfig,
  { siteURL, rateLimit, verify = true, paths, emails }: AccountOptions,
): CollectionConfig => {
  const logInPath = paths?.logIn ?? "/login";
  const resetPasswordPath = paths?.resetPassword ?? "/reset-password";
  const verifyEmailPath = paths?.verifyEmail ?? "/verify-email";
  const resetExpiration = auth?.forgotPassword?.expiration ?? 3_600_000;
  const resetPassword = emails?.resetPassword ?? defaultResetPassword(resetExpiration / 60_000);
  const verifyEmail = emails?.verifyEmail ?? defaultVerifyEmail;

  const resetEmail = ({
    req,
    token,
    user,
  }: {
    req?: PayloadRequest;
    token?: string;
    user?: User;
  }) => {
    if (!req || !token || !user) throw new Error("Payload sent a reset email without its token.");
    return resetPassword({
      url: link(siteURL, resetPasswordPath, token),
      logInURL: req.context[signUpAttempt] === true ? link(siteURL, logInPath) : undefined,
      user,
      req,
    });
  };
  const verificationEmail = ({
    req,
    token,
    user,
  }: {
    req: PayloadRequest;
    token: string;
    user: User;
  }) => verifyEmail({ url: link(siteURL, verifyEmailPath, token), user, req });

  return {
    ...collection,
    admin: { useAsTitle: "email", ...admin },
    endpoints: endpoints === false ? false : [refuseFirstRegister, ...(endpoints ?? [])],
    access: {
      create: isAdminUser,
      read: adminOrSelf(collection.slug),
      update: adminOrSelf(collection.slug),
      delete: isAdminUser,
      ...access,
    },
    hooks: {
      ...hooks,
      beforeOperation: [
        rateLimitHook(collection.slug, rateLimit),
        protectCredentials,
        ...(hooks?.beforeOperation ?? []),
      ],
    },
    auth: {
      tokenExpiration: 14 * 24 * 60 * 60,
      maxLoginAttempts: 0,
      depth: 0,
      ...auth,
      cookies: { secure: true, sameSite: "Lax", ...auth?.cookies },
      forgotPassword: {
        ...auth?.forgotPassword,
        generateEmailSubject: async (args) => (await resetEmail(args ?? {})).subject,
        generateEmailHTML: async (args) => (await resetEmail(args ?? {})).html,
      },
      verify: verify && {
        generateEmailSubject: async (args) => (await verificationEmail(args)).subject,
        generateEmailHTML: async (args) => (await verificationEmail(args)).html,
      },
    },
  };
};
