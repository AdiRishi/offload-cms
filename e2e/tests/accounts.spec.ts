// Site accounts through @adirishi/offload-accounts: a customers collection next to the admin's
// users, the registry's account forms, and the server functions in src/server/account.functions.ts.

import type { APIRequestContext, Browser, Page } from "@playwright/test";

import { callServerFn, expect, type PayloadApi, test as base, unique } from "./fixtures";

const accountFunctions = "src/server/account.functions.ts";
const logIn = { file: accountFunctions, name: "logIn" };
const signUp = { file: accountFunctions, name: "signUp" };
const requestPasswordReset = { file: accountFunctions, name: "requestPasswordReset" };
const turnstileToken = "XXXX.DUMMY.TOKEN.XXXX";
const password = "offload-customer-password";
// The ACCOUNTS binding's limit in wrangler.jsonc.
const attemptsPerMinute = 5;

/**
 * A visitor IP of its own. The rate limit counts per IP, and miniflare gives every local request
 * the same one unless the request names it.
 */
const visitorIP = () =>
  `10.${Array.from({ length: 3 }, () => Math.floor(Math.random() * 256)).join(".")}`;

const visitorHeaders = () => ({ "cf-connecting-ip": visitorIP() });

/**
 * A browser page with no cookies and an IP of its own. The IP goes only on requests to the site,
 * because an extra header on Turnstile's cross-origin requests fails their CORS checks.
 */
const newVisitor = async (browser: Browser, baseURL: string | undefined) => {
  const page = await browser.newPage({ baseURL, storageState: { cookies: [], origins: [] } });
  const headers = visitorHeaders();
  await page.route(
    (url) => url.origin === new URL(baseURL ?? "").origin,
    (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }),
  );
  return page;
};

const customerEmail = (prefix: string) => `${unique(prefix)}@offload.test`;

/** `visitor` is a fresh request context per test, with no cookies and an IP of its own. */
const test = base.extend<{ visitor: APIRequestContext }>({
  visitor: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: visitorHeaders(),
    });
    await use(request);
    await request.dispose();
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type SentEmail = { messageId: string; subject: string; to: string[] };

const isSentEmail = (value: unknown): value is SentEmail =>
  isRecord(value) &&
  typeof value.messageId === "string" &&
  typeof value.subject === "string" &&
  Array.isArray(value.to);

/** The HTML of the newest email to `to`, from miniflare's record of the send_email binding. */
const lastEmail = async (request: APIRequestContext, to: string, subject: string) => {
  let found: SentEmail | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(
        "/cdn-cgi/local/explorer/api/local/email/sending?per_page=100",
      );
      const body: unknown = await response.json();
      const sent = isRecord(body) && Array.isArray(body.result) ? body.result : [];
      found = sent.filter(isSentEmail).find((email) => email.to.includes(to));
      return found?.subject;
    })
    .toBe(subject);
  if (!found) throw new Error(`No email to ${to}`);
  const response = await request.get(
    `/cdn-cgi/local/explorer/api/local/email/sending?email_id=${encodeURIComponent(found.messageId)}`,
  );
  const body: unknown = await response.json();
  const html = isRecord(body) && isRecord(body.result) ? body.result.html : undefined;
  if (typeof html !== "string") throw new Error(`The email to ${to} has no HTML`);
  return html;
};

/** The first link in an email that goes to `path` on the site. */
const linkTo = (html: string, path: string) => {
  const href = [...html.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .find((url) => new URL(url).pathname === path);
  if (!href) throw new Error(`No link to ${path} in ${html}`);
  return new URL(href);
};

/** A customer that the admin creates, already verified, as staff would through the admin. */
const createCustomer = (api: PayloadApi, email: string, data: Record<string, unknown> = {}) =>
  api.create("customers", { email, password, _verified: true, ...data });

const logInThroughForm = async (page: Page, email: string, secret = password) => {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Log in" }).click();
};

const restLogin = (request: APIRequestContext, email: string, secret = password) =>
  request.post("/api/customers/login", { data: { email, password: secret } });

const restToken = async (request: APIRequestContext, email: string) => {
  const response = await restLogin(request, email);
  expect(response.status(), await response.text()).toBe(200);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.token !== "string") throw new Error("Login returned no token");
  return body.token;
};

const signedInAs = async (request: APIRequestContext, token: string) => {
  const response = await request.get("/api/customers/me", {
    headers: { Authorization: `JWT ${token}` },
  });
  const body: unknown = await response.json();
  return isRecord(body) && isRecord(body.user) ? body.user.email : null;
};

test("a visitor signs up with Turnstile, confirms the email, and logs in", async ({
  api,
  baseURL,
  browser,
}) => {
  const email = customerEmail("sign-up");
  const visitor = await newVisitor(browser, baseURL);

  await visitor.goto("/sign-up");
  await visitor.getByLabel("Email").fill(email);
  await visitor.getByLabel("Password", { exact: true }).fill(password);
  await visitor.getByLabel("Confirm password").fill(password);
  await visitor.getByRole("button", { name: "Sign up" }).click();
  await expect(visitor.getByText("Check your email")).toBeVisible();

  const verification = linkTo(
    await lastEmail(api.request, email, "Confirm your email address"),
    "/verify-email",
  );
  expect(verification.origin).toBe(baseURL);

  // An unverified account can't log in yet.
  expect((await restLogin(visitor.request, email)).status()).toBe(403);

  // Opening the link verifies nothing, because mail scanners open links too.
  await visitor.goto(`${verification.pathname}${verification.search}`);
  await expect(visitor.locator("form[data-hydrated]")).toBeVisible();
  expect((await restLogin(visitor.request, email)).status()).toBe(403);
  await visitor.getByRole("button", { name: "Confirm email address" }).click();
  await expect(visitor.getByText("Your email is verified")).toBeVisible();

  await visitor.goto("/login");
  await logInThroughForm(visitor, email);
  await expect(visitor).toHaveURL(/\/account$/);
  await expect(visitor.getByText(`Logged in as ${email}`)).toBeVisible();

  const cookie = (await visitor.context().cookies()).find(({ name }) => name === "payload-token");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: true, path: "/" });
  await visitor.close();
});

test("logging out ends this session, and logging out everywhere ends the others", async ({
  api,
  baseURL,
  browser,
  visitor,
}) => {
  const email = customerEmail("logout");
  await createCustomer(api, email);
  const otherDevice = await restToken(visitor, email);
  const page = await newVisitor(browser, baseURL);

  const sessionToken = async () =>
    (await page.context().cookies()).find(({ name }) => name === "payload-token")?.value ?? "";

  await page.goto("/login");
  await logInThroughForm(page, email);
  await expect(page).toHaveURL(/\/account$/);
  const loggedOut = await sessionToken();
  await page.getByRole("button", { name: email }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  expect(await signedInAs(visitor, loggedOut)).toBeNull();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount$/);
  expect(await signedInAs(visitor, otherDevice)).toBe(email);

  await logInThroughForm(page, email);
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: email }).click();
  const loggedOutEverywhere = await sessionToken();
  await page.getByRole("menuitem", { name: "Log out everywhere" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  expect(await signedInAs(visitor, loggedOutEverywhere)).toBeNull();
  expect(await signedInAs(visitor, otherDevice)).toBeNull();
  await page.close();
});

test("an active customer's session slides past its first expiry", async ({
  api,
  baseURL,
  browser,
}) => {
  // e2e's customers have 90-second sessions, which slide once half has passed.
  test.setTimeout(150_000);
  const email = customerEmail("slide");
  await createCustomer(api, email);
  const page = await newVisitor(browser, baseURL);
  await page.goto("/login");
  await logInThroughForm(page, email);
  await expect(page).toHaveURL(/\/account$/);
  const sessionCookie = async () =>
    (await page.context().cookies()).find(({ name }) => name === "payload-token");
  const first = await sessionCookie();

  await page.waitForTimeout(50_000);
  await page.goto("/account");
  const slid = await sessionCookie();
  expect(slid?.value).not.toBe(first?.value);
  expect(slid?.expires).toBeGreaterThan((first?.expires ?? 0) + 40);

  await page.waitForTimeout(45_000);
  await page.goto("/account");
  await expect(page.getByText(`Logged in as ${email}`)).toBeVisible();
  await page.close();
});

test("a visitor can't create an account through REST", async ({ visitor }) => {
  const created = await visitor.post("/api/customers", {
    data: { email: customerEmail("rest-sign-up"), password },
  });
  expect(created.status(), await created.text()).toBe(403);
});

test("a customer can't change their email or password through REST", async ({ api, visitor }) => {
  const email = customerEmail("self-update");
  const account = await createCustomer(api, email);
  const headers = { Authorization: `JWT ${await restToken(visitor, email)}` };
  const update = (data: Record<string, unknown>) =>
    visitor.patch(`/api/customers/${account.id}`, { data, headers });

  expect((await update({ email: customerEmail("taken-over") })).status()).toBe(403);
  expect((await update({ password: "offload-taken-over-password" })).status()).toBe(403);
  expect((await update({ name: "Ada" })).status()).toBe(200);
  expect((await restLogin(visitor, email)).status()).toBe(200);
});

test("a customer changes their password after confirming the current one", async ({
  api,
  baseURL,
  browser,
  visitor,
}) => {
  const email = customerEmail("change-password");
  await createCustomer(api, email);
  const otherDevice = await restToken(visitor, email);
  const newPassword = "offload-changed-customer-password";
  const page = await newVisitor(browser, baseURL);
  await page.goto("/login?returnTo=/account/password");
  await logInThroughForm(page, email);
  await expect(page).toHaveURL(/\/account\/password$/);

  const change = async (current: string) => {
    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByLabel("Confirm password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
  };
  await change("not-the-current-password");
  await expect(page.getByText("Your current password is wrong.")).toBeVisible();
  expect((await restLogin(visitor, email, newPassword)).status()).toBe(401);

  await change(password);
  await expect(page.getByText("Your password is changed")).toBeVisible();
  expect(await signedInAs(visitor, otherDevice)).toBeNull();
  expect((await restLogin(visitor, email)).status()).toBe(401);
  expect((await restLogin(visitor, email, newPassword)).status()).toBe(200);
  await page.goto("/account");
  await expect(page.getByText(`Logged in as ${email}`)).toBeVisible();
  await page.close();
});

test("a guarded page sends a visitor to log in and back, but never off the site", async ({
  api,
  baseURL,
  browser,
  visitor,
}) => {
  const email = customerEmail("guard");
  await createCustomer(api, email);
  const page = await newVisitor(browser, baseURL);

  await page.goto("/account/bookings");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount%2Fbookings$/);
  await logInThroughForm(page, email);
  await expect(page).toHaveURL(/\/account\/bookings$/);
  await expect(page.getByRole("heading", { name: "Your bookings" })).toBeVisible();
  await page.close();

  const result = await callServerFn(visitor, logIn, {
    email,
    password,
    returnTo: "//evil.test/account",
  });
  expect(result).toEqual({ result: { status: "signed-in", returnTo: "/account" } });
});

test("a customer reads only their own bookings, on the page and through REST", async ({
  api,
  baseURL,
  browser,
  visitor,
}) => {
  const [ada, grace] = [customerEmail("ada"), customerEmail("grace")];
  const [adaAccount, graceAccount] = await Promise.all([
    createCustomer(api, ada),
    createCustomer(api, grace),
  ]);
  const adaBooking = unique("Ada's booking");
  const graceBooking = unique("Grace's booking");
  await api.create("bookings", { title: adaBooking, customer: adaAccount.id });
  const graceDoc = await api.create("bookings", { title: graceBooking, customer: graceAccount.id });

  const token = await restToken(visitor, ada);
  const headers = { Authorization: `JWT ${token}` };
  const list = await visitor.get("/api/bookings?limit=100", { headers });
  const body: unknown = await list.json();
  const titles =
    isRecord(body) && Array.isArray(body.docs)
      ? body.docs.map((doc: unknown) => isRecord(doc) && doc.title)
      : [];
  expect(titles).toEqual([adaBooking]);
  expect((await visitor.get(`/api/bookings/${graceDoc.id}`, { headers })).status()).toBe(404);

  const page = await newVisitor(browser, baseURL);
  await page.goto("/login?returnTo=/account/bookings");
  await logInThroughForm(page, ada);
  await expect(page.getByRole("listitem")).toHaveText([adaBooking]);
  await page.close();
});

test("a customer can't open the admin, list its users, or read another account", async ({
  api,
  baseURL,
  browser,
  visitor,
}) => {
  const [ada, grace] = [customerEmail("ada"), customerEmail("grace")];
  const [adaAccount, graceAccount] = await Promise.all([
    createCustomer(api, ada),
    createCustomer(api, grace),
  ]);
  const headers = { Authorization: `JWT ${await restToken(visitor, ada)}` };

  expect((await visitor.get("/api/users", { headers })).status()).toBe(403);
  expect((await visitor.get(`/api/customers/${graceAccount.id}`, { headers })).status()).toBe(404);
  expect((await visitor.get(`/api/customers/${adaAccount.id}`, { headers })).status()).toBe(200);

  const page = await newVisitor(browser, baseURL);
  await page.goto("/login");
  await logInThroughForm(page, ada);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/unauthorized/);
  await page.close();
});

test("a logged-in customer sees a page's published version, not its draft", async ({
  api,
  baseURL,
  browser,
}) => {
  const slug = unique("customer-draft");
  const doc = await api.create("pages", { _status: "published", slug, title: "Published title" });
  await api.update("pages", doc.id, { title: "Draft title" }, "?draft=true");
  const email = customerEmail("drafts");
  await createCustomer(api, email);

  const page = await newVisitor(browser, baseURL);
  await page.goto("/login");
  await logInThroughForm(page, email);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Published title");
  await page.close();
});

test("a forgotten password resets through the emailed link and ends the other sessions", async ({
  api,
  baseURL,
  browser,
  visitor,
}) => {
  const email = customerEmail("reset");
  await createCustomer(api, email);
  const otherDevice = await restToken(visitor, email);

  const page = await newVisitor(browser, baseURL);
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  const reset = linkTo(
    await lastEmail(api.request, email, "Reset your password"),
    "/reset-password",
  );
  const newPassword = "offload-new-customer-password";
  await page.goto(`${reset.pathname}${reset.search}`);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.close();

  expect(await signedInAs(visitor, otherDevice)).toBeNull();
  expect((await restLogin(visitor, email)).status()).toBe(401);
  expect((await restLogin(visitor, email, newPassword)).status()).toBe(200);
});

test("sign-up and password reset answer the same for a registered email", async ({
  api,
  visitor,
}) => {
  const registered = customerEmail("registered");
  await createCustomer(api, registered);
  const newcomer = customerEmail("newcomer");

  for (const email of [registered, newcomer]) {
    expect(await callServerFn(visitor, signUp, { email, password, turnstileToken })).toEqual({
      result: { status: "check-email" },
    });
  }
  const reminder = await lastEmail(api.request, registered, "You already have an account");
  expect(linkTo(reminder, "/reset-password").searchParams.get("token")).toBeTruthy();
  expect(linkTo(reminder, "/login").pathname).toBe("/login");

  for (const email of [customerEmail("unknown"), newcomer]) {
    expect(await callServerFn(visitor, requestPasswordReset, { email, turnstileToken })).toEqual({
      result: { status: "sent" },
    });
  }
});

test("wrong passwords from many IPs never keep a customer out", async ({
  api,
  playwright,
  baseURL,
}) => {
  const email = customerEmail("not-locked");
  await createCustomer(api, email);
  const attempt = async (secret: string) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: visitorHeaders(),
    });
    const status = (await restLogin(request, email, secret)).status();
    await request.dispose();
    return status;
  };
  const failures = await Promise.all(
    Array.from({ length: 2 * attemptsPerMinute + 1 }, () => attempt("wrong-password")),
  );
  expect(failures).toEqual(failures.map(() => 401));
  expect(await attempt(password)).toBe(200);
});

test("REST logins past the limit for one visitor IP get 429", async ({ api, visitor }) => {
  const email = customerEmail("rest-limited");
  await createCustomer(api, email);
  const statuses: number[] = [];
  // A window can end between attempts, so allow two windows' worth before the refusal.
  for (let attempt = 0; attempt <= 2 * attemptsPerMinute && !statuses.includes(429); attempt++) {
    statuses.push((await restLogin(visitor, email, "wrong-password")).status());
  }
  expect(statuses.at(-1)).toBe(429);
  expect(statuses.filter((status) => status === 401).length).toBeGreaterThanOrEqual(
    attemptsPerMinute,
  );
});

test("password reset requests past the limit for one email are refused", async ({
  api,
  playwright,
  baseURL,
}) => {
  const email = customerEmail("reset-limited");
  await createCustomer(api, email);
  const statuses: string[] = [];
  for (
    let attempt = 0;
    attempt <= 2 * attemptsPerMinute && !statuses.includes("limited");
    attempt++
  ) {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: visitorHeaders(),
    });
    const outcome = await callServerFn(request, requestPasswordReset, { email, turnstileToken });
    await request.dispose();
    statuses.push(
      isRecord(outcome) && isRecord(outcome.result) ? String(outcome.result.status) : "",
    );
  }
  expect(statuses.at(-1)).toBe("limited");
  expect(statuses.filter((status) => status === "sent").length).toBeGreaterThanOrEqual(
    attemptsPerMinute,
  );
});

test("failed logins past the limit for one visitor IP are refused", async ({ api, visitor }) => {
  const emails = await Promise.all(
    Array.from({ length: 2 * attemptsPerMinute + 1 }, async () => {
      const email = customerEmail("same-ip");
      await createCustomer(api, email);
      return email;
    }),
  );
  const statuses: string[] = [];
  for (const email of emails) {
    const outcome = await callServerFn(visitor, logIn, { email, password: "wrong-password" });
    statuses.push(
      isRecord(outcome) && isRecord(outcome.result) ? String(outcome.result.status) : "",
    );
    if (statuses.includes("limited")) break;
  }
  expect(statuses.at(-1)).toBe("limited");
  expect(statuses.filter((status) => status === "invalid").length).toBeGreaterThanOrEqual(
    attemptsPerMinute,
  );
});
