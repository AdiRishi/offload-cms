// Site accounts in the customers collection, shared by the suites that need a logged-in customer.

import type { APIRequestContext } from "@playwright/test";

import { expect, type PayloadApi } from "./fixtures";

export const password = "offload-customer-password";

/**
 * A visitor IP of its own. The rate limit counts per IP, and miniflare gives every local request
 * the same one unless the request names it.
 */
const visitorIP = () =>
  `10.${Array.from({ length: 3 }, () => Math.floor(Math.random() * 256)).join(".")}`;

export const visitorHeaders = () => ({ "cf-connecting-ip": visitorIP() });

/** A customer that the admin creates, already verified, as staff would through the admin. */
export const createCustomer = (
  api: PayloadApi,
  email: string,
  data: Record<string, unknown> = {},
) => api.create("customers", { email, password, _verified: true, ...data });

export const restLogin = (request: APIRequestContext, email: string, secret = password) =>
  request.post("/api/customers/login", { data: { email, password: secret } });

export const restToken = async (request: APIRequestContext, email: string) => {
  const response = await restLogin(request, email);
  expect(response.status(), await response.text()).toBe(200);
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    throw new Error("Login returned no token");
  }
  return body.token;
};
