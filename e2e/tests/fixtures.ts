import { type APIRequestContext, expect, test as base } from "@playwright/test";
import { readFileSync } from "node:fs";

import { adminStorageState } from "./credentials";

export type Doc = Record<string, unknown> & { id: number | string };

const isDoc = (value: unknown): value is Doc =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  (typeof value.id === "number" || typeof value.id === "string");

type ListResult = { docs: Doc[]; totalDocs: number };

const isListResult = (value: unknown): value is ListResult =>
  typeof value === "object" &&
  value !== null &&
  "docs" in value &&
  Array.isArray(value.docs) &&
  value.docs.every(isDoc) &&
  "totalDocs" in value &&
  typeof value.totalDocs === "number";

/** A REST client for Payload, signed in as the admin unless `token` is empty. */
export class PayloadApi {
  constructor(
    readonly request: APIRequestContext,
    readonly token: string,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return this.token ? { Authorization: `JWT ${this.token}`, ...extra } : extra;
  }

  async create(collection: string, data: Record<string, unknown>, query = ""): Promise<Doc> {
    const response = await this.request.post(`/api/${collection}${query}`, {
      data,
      headers: this.headers(),
    });
    expect(response.status(), await response.text()).toBe(201);
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("doc" in body) || !isDoc(body.doc)) {
      throw new Error(`Unexpected create response: ${JSON.stringify(body)}`);
    }
    return body.doc;
  }

  async update(collection: string, id: Doc["id"], data: Record<string, unknown>, query = "") {
    const response = await this.request.patch(`/api/${collection}/${id}${query}`, {
      data,
      headers: this.headers(),
    });
    expect(response.status(), await response.text()).toBe(200);
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("doc" in body) || !isDoc(body.doc)) {
      throw new Error(`Unexpected update response: ${JSON.stringify(body)}`);
    }
    return body.doc;
  }

  async findByID(collection: string, id: Doc["id"], query = ""): Promise<Doc> {
    const response = await this.request.get(`/api/${collection}/${id}${query}`, {
      headers: this.headers(),
    });
    expect(response.status(), await response.text()).toBe(200);
    const body: unknown = await response.json();
    if (!isDoc(body)) throw new Error(`Unexpected document: ${JSON.stringify(body)}`);
    return body;
  }

  async find(collection: string, query = ""): Promise<ListResult> {
    const response = await this.request.get(`/api/${collection}${query}`, {
      headers: this.headers(),
    });
    expect(response.status(), await response.text()).toBe(200);
    const body: unknown = await response.json();
    if (!isListResult(body)) throw new Error(`Unexpected list: ${JSON.stringify(body)}`);
    return body;
  }

  async global(slug: string, query = ""): Promise<Record<string, unknown>> {
    const response = await this.request.get(`/api/globals/${slug}${query}`, {
      headers: this.headers(),
    });
    expect(response.status(), await response.text()).toBe(200);
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null)
      throw new Error(`Unexpected global: ${JSON.stringify(body)}`);
    return { ...body };
  }

  async graphql(query: string, variables: Record<string, unknown> = {}) {
    const response = await this.request.post("/api/graphql", {
      data: { query, variables },
      headers: this.headers(),
    });
    expect(response.status(), await response.text()).toBe(200);
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) throw new Error(`Unexpected GraphQL body`);
    return { ...body };
  }

  async upload(
    collection: string,
    file: { buffer: Buffer; mimeType: string; name: string },
    data: object,
  ) {
    const response = await this.request.post(`/api/${collection}`, {
      headers: this.headers(),
      multipart: { _payload: JSON.stringify(data), file },
    });
    expect(response.status(), await response.text()).toBe(201);
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("doc" in body) || !isDoc(body.doc)) {
      throw new Error(`Unexpected upload response: ${JSON.stringify(body)}`);
    }
    return body.doc;
  }

  /** Fires the Worker's Cron Trigger, which runs Payload's due jobs. */
  async runCron() {
    const response = await this.request.get("/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*");
    expect(response.status()).toBe(200);
  }
}

export const login = async (
  request: APIRequestContext,
  collection: string,
  email: string,
  password: string,
) => {
  const response = await request.post(`/api/${collection}/login`, { data: { email, password } });
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

/** A unique suffix, so tests running in parallel never collide on slugs or emails. */
export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** The setup project's session token, which every worker reuses instead of logging in. */
const adminToken = () => {
  const state: unknown = JSON.parse(readFileSync(adminStorageState, "utf8"));
  const cookies =
    typeof state === "object" && state !== null && "cookies" in state ? state.cookies : [];
  const token = Array.isArray(cookies)
    ? cookies.find(
        (cookie: unknown) =>
          typeof cookie === "object" &&
          cookie !== null &&
          "name" in cookie &&
          cookie.name === "payload-token",
      )
    : undefined;
  if (
    typeof token !== "object" ||
    token === null ||
    !("value" in token) ||
    typeof token.value !== "string"
  ) {
    throw new Error(`No payload-token cookie in ${adminStorageState}`);
  }
  return token.value;
};

/**
 * `api` is signed in as the admin and shared by a worker, so `beforeAll` hooks can seed
 * data. `anonymous` is a fresh context per test with an explicitly empty storage state:
 * request contexts otherwise inherit the project's admin session.
 */
export const test = base.extend<{ anonymous: PayloadApi }, { api: PayloadApi }>({
  anonymous: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    await use(new PayloadApi(request, ""));
    await request.dispose();
  },
  api: [
    async ({ playwright }, use, workerInfo) => {
      const request = await playwright.request.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      await use(new PayloadApi(request, adminToken()));
      await request.dispose();
    },
    { scope: "worker" },
  ],
});

export { expect };
