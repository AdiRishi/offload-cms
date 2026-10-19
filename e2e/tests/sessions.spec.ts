// Payload keeps each login session as a row in the user's sessions array. D1 has no
// transactions, so logins and token refreshes as one user at the same moment must not rewrite
// each other's rows.

import type { APIRequestContext, APIResponse } from "@playwright/test";

import { type Doc, expect, login, PayloadApi, test, unique } from "./fixtures";

const signedInUserID = async (request: APIRequestContext, token: string) => {
  const response = await request.get("/api/users/me", {
    headers: { Authorization: `JWT ${token}` },
  });
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  return typeof body === "object" &&
    body !== null &&
    "user" in body &&
    typeof body.user === "object" &&
    body.user !== null &&
    "id" in body.user
    ? body.user.id
    : null;
};

const issuedToken = async (response: APIResponse) => {
  const body: unknown = await response.json();
  if (typeof body === "object" && body !== null) {
    if ("token" in body && typeof body.token === "string") return body.token;
    if ("refreshedToken" in body && typeof body.refreshedToken === "string") {
      return body.refreshedToken;
    }
  }
  throw new Error(`No token in ${JSON.stringify(body)}`);
};

/** The time at which the session that `token` belongs to expires, from the user's own record. */
const sessionExpiry = async (request: APIRequestContext, userID: Doc["id"], token: string) => {
  const claims: unknown = JSON.parse(
    Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
  );
  const sid = typeof claims === "object" && claims !== null && "sid" in claims ? claims.sid : null;
  const { sessions } = await new PayloadApi(request, token).findByID("users", userID);
  const session: unknown = Array.isArray(sessions)
    ? sessions.find(
        (each: unknown) =>
          typeof each === "object" && each !== null && "id" in each && each.id === sid,
      )
    : undefined;
  if (
    typeof session !== "object" ||
    session === null ||
    !("expiresAt" in session) ||
    typeof session.expiresAt !== "string"
  ) {
    throw new Error(`No session ${String(sid)} in ${JSON.stringify(sessions)}`);
  }
  return Date.parse(session.expiresAt);
};

test("concurrent logins as one user each keep a session, and logout ends only its own", async ({
  anonymous,
  api,
}) => {
  const email = `${unique("sessions")}@offload.test`;
  const password = "offload-sessions-password";
  const user = await api.create("users", { email, password });
  const { request } = anonymous;

  // The logins below then race on a session row that already exists.
  const firstToken = await login(request, "users", email, password);

  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      request.post("/api/users/login", { data: { email, password } }),
    ),
  );
  expect(responses.map((response) => response.status())).toEqual(Array(8).fill(200));

  const tokens = [firstToken];
  for (const response of responses) {
    tokens.push(await issuedToken(response));
  }

  for (const token of tokens) {
    expect(await signedInUserID(request, token)).toBe(user.id);
  }

  const [loggedOut, ...stillSignedIn] = tokens;
  const logout = await request.post("/api/users/logout", {
    headers: { Authorization: `JWT ${loggedOut}` },
  });
  expect(logout.status(), await logout.text()).toBe(200);

  expect(await signedInUserID(request, loggedOut)).toBeNull();
  for (const token of stillSignedIn) {
    expect(await signedInUserID(request, token)).toBe(user.id);
  }
});

test("a smoke test of the refresh patch: refreshes and logins as one user keep every session", async ({
  anonymous,
  api,
}) => {
  const email = `${unique("refresh")}@offload.test`;
  const password = "offload-sessions-password";
  const user = await api.create("users", { email, password });
  const { request } = anonymous;

  const existingTokens = [
    await login(request, "users", email, password),
    await login(request, "users", email, password),
  ];
  const existingSessions = await Promise.all(
    existingTokens.map(async (token) => ({
      expiry: await sessionExpiry(request, user.id, token),
      token,
    })),
  );

  const refresh = (token: string) =>
    request.post("/api/users/refresh-token", { headers: { Authorization: `JWT ${token}` } });
  const [refreshes, logins] = await Promise.all([
    Promise.all(existingTokens.flatMap((token) => [refresh(token), refresh(token)])),
    Promise.all(
      Array.from({ length: 6 }, () =>
        request.post("/api/users/login", { data: { email, password } }),
      ),
    ),
  ]);
  expect([...refreshes, ...logins].map((response) => response.status())).toEqual(
    Array(10).fill(200),
  );

  const tokens = [
    ...existingTokens,
    ...(await Promise.all([...refreshes, ...logins].map(issuedToken))),
  ];
  expect(await Promise.all(tokens.map((token) => signedInUserID(request, token)))).toEqual(
    tokens.map(() => user.id),
  );

  const refreshedSessions = await Promise.all(
    existingSessions.map(async ({ expiry, token }) => ({
      after: await sessionExpiry(request, user.id, token),
      before: expiry,
    })),
  );
  for (const { after, before } of refreshedSessions) {
    expect(after).toBeGreaterThan(before);
  }
});
