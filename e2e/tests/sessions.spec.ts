// Payload keeps each login session as a row in the user's sessions array. D1 has no
// transactions, so logins as one user at the same moment must not rewrite each other's rows.

import type { APIRequestContext } from "@playwright/test";

import { expect, login, test, unique } from "./fixtures";

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
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("token" in body)) {
      throw new Error(`Login returned no token: ${JSON.stringify(body)}`);
    }
    tokens.push(String(body.token));
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
