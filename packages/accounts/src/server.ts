import type {
  AuthCollectionSlug,
  AuthenticatedUser,
  AuthRuntimeFields,
  Collection,
  DataFromCollectionSlug,
  Payload,
  RequiredDataFromCollectionSlug,
} from "payload";

import { verifyTurnstile } from "@adirishi/offload-cloudflare";
import { redirect } from "@tanstack/react-router";
import { getRequest, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import {
  APIError,
  AuthenticationError,
  createPayloadRequest,
  executeAuthStrategies,
  generateExpiredPayloadCookie,
  generatePayloadCookie,
  LockedAuth,
  loginOperation,
  logoutOperation,
  parseCookies,
  refreshOperation,
  resetPasswordOperation,
  UnverifiedEmail,
  ValidationError,
} from "payload";
import { getSafeRedirect } from "payload/shared";
import { cache } from "react";

import type {
  ChangePasswordInput,
  ChangePasswordResult,
  ForgotPasswordInput,
  ForgotPasswordResult,
  LogInInput,
  LogInResult,
  ResetPasswordInput,
  ResetPasswordResult,
  SignUpInput,
  SignUpResult,
  VerifyEmailInput,
  VerifyEmailResult,
} from "./index.ts";

import { signUpAttempt } from "./context.ts";

export type AccountHelpersOptions<TSlug extends AuthCollectionSlug> = {
  /** The site's Payload without a user, such as `getVisitorPayload` from `createPayloadHelpers()`. */
  getPayload: () => Promise<Payload>;
  /** The account collection, made with `accountCollection()`. */
  collection: TSlug;
  /** Where `requireAccount()` sends a visitor who isn't logged in. Default `/login`. */
  loginPath?: string;
  /** Where a visitor goes after logging in without a safe `returnTo`. Default `/account`. */
  accountPath?: string;
};

/** A logged-in account: its document, with the session fields Payload adds to a request's user. */
export type Account<TSlug extends AuthCollectionSlug> = DataFromCollectionSlug<TSlug> &
  AuthRuntimeFields;

export type AccountHelpers<TSlug extends AuthCollectionSlug> = {
  /**
   * The visitor's account, or `null` when the visitor isn't logged in or is a user of another
   * collection, such as an editor. Memoised for one server component render. When it finds an
   * account, it marks the response `Cache-Control: private, no-store` and slides the session.
   */
  getAccount: () => Promise<Account<TSlug> | null>;
  /** `getAccount()`, or a redirect to `loginPath` for a visitor who isn't logged in. */
  requireAccount: () => Promise<Account<TSlug>>;
  logIn: (input: LogInInput) => Promise<LogInResult>;
  /** Ends the visitor's session, or every session of their account, and expires the cookie. */
  logOut: (options?: { everywhere?: boolean }) => Promise<void>;
  /**
   * Creates an account after a Turnstile check with the action `sign-up`. With email
   * verification, the account gets the verification email. Without it, the visitor is logged in.
   * An email that already has an account gets a password reset email instead, and the result is
   * `check-email` either way.
   */
  signUp: (
    input: SignUpInput,
    options: {
      /** The Turnstile widget's secret key. */
      turnstileSecret: string;
      /** The site's own fields for the account, validated by the server function. */
      data?: Omit<RequiredDataFromCollectionSlug<TSlug>, "email" | "password">;
    },
  ) => Promise<SignUpResult>;
  /**
   * Sends a password reset email after a Turnstile check with the action `forgot-password`.
   * The result is `sent` whether or not the email has an account.
   */
  requestPasswordReset: (
    input: ForgotPasswordInput,
    options: { turnstileSecret: string },
  ) => Promise<ForgotPasswordResult>;
  /**
   * Sets a new password with the token from a reset email, ends the account's other sessions,
   * and logs the visitor in. The email proves the visitor owns the address, so it also verifies
   * an account that never verified.
   */
  resetPassword: (input: ResetPasswordInput) => Promise<ResetPasswordResult>;
  /** Verifies the account's email with the token from the verification email. */
  verifyEmail: (input: VerifyEmailInput) => Promise<VerifyEmailResult>;
  /**
   * Sets a new password for the logged-in account after checking its current password, keeps
   * the visitor's session, and ends the account's other sessions.
   */
  changePassword: (input: ChangePasswordInput) => Promise<ChangePasswordResult>;
};

type CookieParts = ReturnType<
  typeof generatePayloadCookie<{
    collectionAuthConfig: Collection["config"]["auth"];
    cookiePrefix: string;
    returnCookieAsObject: true;
    token: string;
  }>
>;

const sameSites = { Lax: "lax", Strict: "strict", None: "none" } as const;

const writeCookie = ({
  name,
  value,
  domain,
  path,
  httpOnly,
  secure,
  sameSite,
  expires,
}: CookieParts) =>
  setCookie(name, value ?? "", {
    domain,
    path,
    httpOnly,
    secure,
    sameSite: sameSite && sameSites[sameSite],
    expires: expires ? new Date(expires) : undefined,
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The `exp` claim of a JWT that a strategy has already verified, in seconds. */
const expiresAt = (token: string) => {
  const claims: unknown = JSON.parse(
    Buffer.from(token.split(".")[1] ?? "", "base64url").toString(),
  );
  return isRecord(claims) && typeof claims.exp === "number" ? claims.exp : 0;
};

const isTooManyRequests = (error: unknown) => error instanceof APIError && error.status === 429;

const visitorRequest = (payload: Payload, user?: AuthenticatedUser) => {
  const { headers, url } = getRequest();
  return createPayloadRequest({ payload, user, req: { headers, url } });
};

const setSessionCookie = (payload: Payload, collection: Collection, token: string) =>
  writeCookie(
    generatePayloadCookie({
      collectionAuthConfig: collection.config.auth,
      cookiePrefix: payload.config.cookiePrefix,
      returnCookieAsObject: true,
      token,
    }),
  );

const signIn = async (
  payload: Payload,
  collection: Collection,
  email: string,
  password: string,
) => {
  const { token } = await loginOperation({
    collection,
    data: { email, password },
    req: await visitorRequest(payload),
  });
  if (!token) throw new Error("Payload logged the account in without a token.");
  setSessionCookie(payload, collection, token);
};

/**
 * Extends the session once it has used half its lifetime, so an active visitor stays logged in
 * and an idle one is logged out after `tokenExpiration`. Only a session from the cookie slides.
 */
const slideSession = async (
  payload: Payload,
  collection: Collection,
  account: AuthenticatedUser,
) => {
  const { headers } = getRequest();
  const token = parseCookies(headers).get(`${payload.config.cookiePrefix}-token`);
  if (!token || headers.has("authorization")) return;
  const lifetime = collection.config.auth.tokenExpiration;
  if (expiresAt(token) - Date.now() / 1000 > lifetime / 2) return;
  const { refreshedToken } = await refreshOperation({
    collection,
    req: await visitorRequest(payload, account),
  });
  setSessionCookie(payload, collection, refreshedToken);
};

/**
 * Server helpers for a site's account pages, built on one account collection. Call them from the
 * site's own `createServerFn` handlers. Each helper that takes visitor input returns a result
 * whose `status` the form shows, logs unexpected errors, and answers `error` for them.
 */
export const createAccountHelpers = <TSlug extends AuthCollectionSlug>({
  getPayload,
  collection: slug,
  loginPath = "/login",
  accountPath = "/account",
}: AccountHelpersOptions<TSlug>): AccountHelpers<TSlug> => {
  const load = async () => {
    const payload = await getPayload();
    const collection = payload.collections[slug];
    if (!collection?.config.auth) throw new Error(`${slug} is not an auth collection.`);
    return { payload, collection };
  };

  const isAccount = (user: AuthenticatedUser | null): user is AuthenticatedUser & Account<TSlug> =>
    user?.collection === slug;

  const safeReturnTo = (returnTo: string | undefined) =>
    getSafeRedirect({ redirectTo: returnTo ?? accountPath, fallbackTo: accountPath });

  const getAccount = cache(async () => {
    const { payload, collection } = await load();
    const { user } = await executeAuthStrategies({
      headers: getRequest().headers,
      payload,
      canSetHeaders: false,
    });
    if (!isAccount(user)) return null;
    setResponseHeader("Cache-Control", "private, no-store");
    await slideSession(payload, collection, user);
    return user;
  });

  const requireAccount = async () => {
    const account = await getAccount();
    if (!account) throw redirect({ href: loginPath });
    return account;
  };

  const logIn = async ({ email, password, returnTo }: LogInInput): Promise<LogInResult> => {
    try {
      const { payload, collection } = await load();
      await signIn(payload, collection, email, password);
      return { status: "signed-in", returnTo: safeReturnTo(returnTo) };
    } catch (error) {
      if (error instanceof AuthenticationError) return { status: "invalid" };
      if (error instanceof UnverifiedEmail) return { status: "email-unverified" };
      if (error instanceof LockedAuth) return { status: "locked" };
      if (isTooManyRequests(error)) return { status: "limited" };
      console.error("A login failed", error);
      return { status: "error" };
    }
  };

  const logOut = async ({ everywhere = false }: { everywhere?: boolean } = {}) => {
    const { payload, collection } = await load();
    const { user } = await executeAuthStrategies({
      headers: getRequest().headers,
      payload,
      canSetHeaders: false,
    });
    const userCollection = user && payload.collections[user.collection];
    if (user && userCollection) {
      await logoutOperation({
        allSessions: everywhere,
        collection: userCollection,
        req: await visitorRequest(payload, user),
      });
    }
    writeCookie(
      generateExpiredPayloadCookie({
        collectionAuthConfig: (userCollection ?? collection).config.auth,
        cookiePrefix: payload.config.cookiePrefix,
        returnCookieAsObject: true,
      }),
    );
  };

  const remindExistingAccount = async (payload: Payload, email: string): Promise<SignUpResult> => {
    try {
      await payload.forgotPassword({
        collection: slug,
        data: { email },
        context: { [signUpAttempt]: true },
        req: await visitorRequest(payload),
      });
    } catch (error) {
      // A different answer here would show that the email has an account.
      if (!isTooManyRequests(error)) console.error("A sign-up reminder email failed", error);
    }
    return { status: "check-email" };
  };

  const signUp = async (
    { email, password, turnstileToken, returnTo }: SignUpInput,
    {
      turnstileSecret,
      data,
    }: {
      /** The Turnstile widget's secret key. */
      turnstileSecret: string;
      /** The site's own fields for the account, validated by the server function. */
      data?: Omit<RequiredDataFromCollectionSlug<TSlug>, "email" | "password">;
    },
  ): Promise<SignUpResult> => {
    try {
      const request = getRequest();
      const verified = await verifyTurnstile({
        token: turnstileToken,
        secret: turnstileSecret,
        hostname: new URL(request.url).hostname,
        action: "sign-up",
        remoteip: request.headers.get("cf-connecting-ip") ?? undefined,
      });
      if (!verified) return { status: "unverified" };

      const { payload, collection } = await load();
      const existing = await payload.count({
        collection: slug,
        where: { email: { equals: email } },
        overrideAccess: true,
      });
      if (existing.totalDocs > 0) return await remindExistingAccount(payload, email);

      try {
        await payload.create({
          collection: slug,
          data: { ...data, email, password },
          overrideAccess: true,
          req: await visitorRequest(payload),
        });
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        const errors = error.data.errors;
        // A sign-up for the same email that finished first.
        if (errors.some(({ path }) => path === "email")) {
          return await remindExistingAccount(payload, email);
        }
        return {
          status: "invalid",
          errors: Object.fromEntries(errors.map(({ path, message }) => [path, message])),
        };
      }

      if (collection.config.auth.verify) return { status: "check-email" };
      await signIn(payload, collection, email, password);
      return { status: "signed-in", returnTo: safeReturnTo(returnTo) };
    } catch (error) {
      console.error("A sign-up failed", error);
      return { status: "error" };
    }
  };

  const requestPasswordReset = async (
    { email, turnstileToken }: ForgotPasswordInput,
    { turnstileSecret }: { turnstileSecret: string },
  ): Promise<ForgotPasswordResult> => {
    try {
      const request = getRequest();
      const verified = await verifyTurnstile({
        token: turnstileToken,
        secret: turnstileSecret,
        hostname: new URL(request.url).hostname,
        action: "forgot-password",
        remoteip: request.headers.get("cf-connecting-ip") ?? undefined,
      });
      if (!verified) return { status: "unverified" };
      const { payload } = await load();
      await payload.forgotPassword({
        collection: slug,
        data: { email },
        req: await visitorRequest(payload),
      });
      return { status: "sent" };
    } catch (error) {
      if (isTooManyRequests(error)) return { status: "limited" };
      console.error("A password reset request failed", error);
      return { status: "error" };
    }
  };

  const resetPassword = async ({
    token,
    password,
  }: ResetPasswordInput): Promise<ResetPasswordResult> => {
    try {
      const { payload, collection } = await load();
      const req = await visitorRequest(payload);
      const result = await resetPasswordOperation({
        collection,
        data: { token, password },
        overrideAccess: true,
        req,
      });
      const { id } = result.user;
      if (!result.token || (typeof id !== "number" && typeof id !== "string")) {
        throw new Error("Payload reset the password without a token or an account.");
      }
      if (collection.config.auth.verify) {
        await payload.db.updateOne({
          id,
          collection: slug,
          data: { _verified: true },
          req,
          returning: false,
        });
      }
      setSessionCookie(payload, collection, result.token);
      return { status: "signed-in", returnTo: accountPath };
    } catch (error) {
      if (error instanceof APIError && error.status === 403) return { status: "invalid" };
      console.error("A password reset failed", error);
      return { status: "error" };
    }
  };

  const verifyEmail = async ({ token }: VerifyEmailInput): Promise<VerifyEmailResult> => {
    try {
      const { payload } = await load();
      await payload.verifyEmail({ collection: slug, token });
      return { status: "verified" };
    } catch (error) {
      if (error instanceof APIError && error.status === 403) return { status: "invalid" };
      console.error("An email verification failed", error);
      return { status: "error" };
    }
  };

  const changePassword = async ({
    currentPassword,
    newPassword,
  }: ChangePasswordInput): Promise<ChangePasswordResult> => {
    try {
      const account = await getAccount();
      if (!account?.email) return { status: "signed-out" };
      const { payload, collection } = await load();
      // A login checks the current password and applies the login rate limit. The session it
      // adds ends with the account's other sessions when the password changes.
      await loginOperation({
        collection,
        data: { email: account.email, password: currentPassword },
        req: await visitorRequest(payload),
      });
      await payload.update({
        collection: slug,
        id: account.id,
        data: { password: newPassword },
        overrideAccess: true,
        req: await visitorRequest(payload, account),
      });
      return { status: "changed" };
    } catch (error) {
      if (error instanceof AuthenticationError) return { status: "invalid" };
      if (error instanceof LockedAuth || isTooManyRequests(error)) return { status: "limited" };
      console.error("A password change failed", error);
      return { status: "error" };
    }
  };

  return {
    getAccount,
    requireAccount,
    logIn,
    logOut,
    signUp,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    changePassword,
  };
};
