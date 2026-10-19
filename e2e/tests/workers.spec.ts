// Behaviour that depends on Cloudflare: R2 storage, the Images and Email Service bindings,
// the Cron Trigger handler from `createPayloadWorker`, and plugins whose dependencies have
// to bundle for workerd.

import { lexical, png } from "./data";
import { expect, test, unique } from "./fixtures";

test("R2 stores uploads byte for byte and serves byte ranges", async ({ anonymous, api }) => {
  const image = png({ height: 48, width: 64 });
  const media = await api.upload(
    "media",
    { buffer: image, mimeType: "image/png", name: `${unique("r2")}.png` },
    { alt: "R2" },
  );
  expect(media).toMatchObject({ height: 48, width: 64 });

  const file = await anonymous.request.get(String(media.url));
  expect(Buffer.from(await file.body()).equals(image)).toBe(true);

  const range = await anonymous.request.get(String(media.url), { headers: { Range: "bytes=0-7" } });
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(8);
});

test("the Images binding generates upload variants", async ({ api }) => {
  const media = await api.upload(
    "media",
    {
      buffer: png({ height: 240, width: 320 }),
      mimeType: "image/png",
      name: `${unique("variants")}.png`,
    },
    { alt: "Variants" },
  );
  expect(media).toMatchObject({ variants: { thumbnail: { height: 120, width: 160 } } });
});

test("Email Service sends Payload's password reset email", async ({ anonymous, api }) => {
  const email = `${unique("reset")}@example.com`;
  await api.create("users", { email, password: unique("password") });

  const requested = await anonymous.request.post("/api/users/forgot-password", { data: { email } });
  expect(requested.status(), await requested.text()).toBe(200);

  // Miniflare's local explorer lists what the local send_email binding received.
  const sent = await api.request.get("/cdn-cgi/local/explorer/api/local/email/sending");
  expect(await sent.json()).toMatchObject({
    result: expect.arrayContaining([
      expect.objectContaining({ subject: "Reset Your Password", to: [email] }),
    ]),
  });
});

test("hooks, virtual fields and custom endpoints run in the Worker", async ({ api }) => {
  const title = unique("Hook Title");
  const post = await api.create("posts", { _status: "published", excerpt: "one two three", title });
  expect(post.slug).toBe(title.toLowerCase().replace(/[^a-z0-9]+/g, "-"));

  const audit = await api.find("audit-logs", `?where[documentID][equals]=${post.id}`);
  expect(audit.docs).toEqual([expect.objectContaining({ action: "create", summary: title })]);

  const words = await api.request.get(`/api/posts/${post.id}/word-count`, {
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(await words.json()).toEqual({ id: post.id, words: 3 });
});

test("the Cron Trigger runs queued tasks and workflows", async ({ api }) => {
  const message = unique("heartbeat");
  const queued = await Promise.all(
    [false, true].map((workflow) =>
      api.request.post("/api/e2e/queue", {
        data: { message: workflow ? `${message} workflow` : message, workflow },
        headers: { Authorization: `JWT ${api.token}` },
      }),
    ),
  );
  expect(queued.map((response) => response.status())).toEqual([200, 200]);

  await api.runCron();
  await expect
    .poll(async () =>
      (await api.find("audit-logs", `?where[summary][like]=${message}&sort=summary`)).docs.map(
        (doc) => doc.summary,
      ),
    )
    .toEqual([message, `${message} workflow (1 of 2)`, `${message} workflow (2 of 2)`]);
});

test("scheduled publishing runs on the Cron Trigger", async ({ anonymous, api }) => {
  const slug = unique("scheduled");
  const page = await api.create(
    "pages",
    { _status: "draft", slug, title: "Scheduled" },
    "?draft=true",
  );
  const scheduled = await api.request.post("/api/e2e/schedule-publish", {
    data: { collection: "pages", id: page.id },
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(scheduled.status(), await scheduled.text()).toBe(200);
  expect((await anonymous.find("pages", `?where[slug][equals]=${slug}`)).totalDocs).toBe(0);

  await api.runCron();
  await expect
    .poll(async () => (await anonymous.find("pages", `?where[slug][equals]=${slug}`)).totalDocs)
    .toBe(1);
});

test("search indexes posts and form builder accepts submissions", async ({ anonymous, api }) => {
  const title = unique("Searchable");
  const post = await api.create("posts", { _status: "published", title });
  await expect
    .poll(
      async () =>
        (await anonymous.find("search", `?where[title][equals]=${title}&depth=0`)).docs[0]?.doc,
    )
    .toEqual({ relationTo: "posts", value: post.id });

  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thanks!"]),
    confirmationType: "message",
    fields: [{ blockType: "email", label: "Email", name: "email", required: true }],
    title: unique("Contact"),
  });
  const submission = await anonymous.request.post("/api/form-submissions", {
    data: { form: form.id, submissionData: [{ field: "email", value: "ada@offload.test" }] },
  });
  expect(submission.status(), await submission.text()).toBe(201);
});
