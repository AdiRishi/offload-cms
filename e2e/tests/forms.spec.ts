// Form-builder forms on the site: the components installed from Offload's shadcn registry,
// Turnstile with Cloudflare's testing keys, and @adirishi/offload-form-builder on the server.

import type { Page } from "@playwright/test";

import { lexical } from "./data";
import { callServerFn, expect, type PayloadApi, postServerFn, test, unique } from "./fixtures";

const visit = async (page: Page, path: string) => {
  await page.goto(path);
  const form = page.locator("form[data-hydrated]");
  await expect(form).toBeVisible();
  return form;
};

const submissionsOf = async (api: PayloadApi, form: string | number) =>
  (await api.find("form-submissions", `?where[form][equals]=${form}&depth=0`)).docs;

test.use({ storageState: { cookies: [], origins: [] } });

const submitForm = { file: "src/server/forms.functions.ts", name: "submitForm" };
// Cloudflare's testing secret passes this token.
const turnstileToken = "XXXX.DUMMY.TOKEN.XXXX";

/** A published page that offers a form with a required email and an optional topic. */
const offeredForm = async (api: PayloadApi) => {
  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thanks."]),
    confirmationType: "message",
    fields: [
      { blockType: "email", label: "Email", name: "email", required: true },
      {
        blockType: "select",
        label: "Topic",
        name: "topic",
        options: [
          { label: "Courses", value: "courses" },
          { label: "Retreats", value: "retreats" },
        ],
      },
    ],
    title: unique("Crafted"),
  });
  await api.create("pages", {
    _status: "published",
    layout: [{ blockType: "form", form: form.id }],
    slug: unique("crafted-page"),
    title: "Offers a form",
  });
  return form;
};

test("a visitor sends a form built in the form builder", async ({ api, page }) => {
  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thank you, we will reply within two days."]),
    confirmationType: "message",
    fields: [
      { blockType: "text", label: "Your name", name: "name", required: true },
      { blockType: "email", label: "Email", name: "email", required: true },
      {
        blockType: "select",
        label: "Topic",
        name: "topic",
        options: [
          { label: "Courses", value: "courses" },
          { label: "Retreats", value: "retreats" },
        ],
      },
      { blockType: "country", label: "Country", name: "country" },
      { blockType: "textarea", label: "Message", name: "message", required: true },
      { blockType: "checkbox", label: "You may contact me", name: "consent", required: true },
    ],
    submitButtonLabel: "Send enquiry",
    title: unique("Enquiry"),
  });
  const slug = unique("form-page");
  await api.create("pages", {
    _status: "published",
    layout: [{ blockType: "form", form: form.id }],
    slug,
    title: "Ask us anything",
  });

  const element = await visit(page, `/${slug}`);
  await element.getByRole("button", { name: "Send enquiry" }).click();
  await expect(element.getByText("This field is required.")).toHaveCount(4);
  await expect(element.getByLabel("Your name")).toBeFocused();

  await element.getByLabel("Your name").fill("Asha Ramdin");
  await element.getByLabel("Email").fill("asha@example.mu");
  await element.getByLabel("Topic").selectOption("Retreats");
  await element.getByLabel("Country").selectOption("Mauritius");
  await element.getByLabel("Message").fill("Is there space on the next retreat?");
  await element.getByRole("checkbox", { name: "You may contact me" }).click();
  await element.getByRole("button", { name: "Send enquiry" }).click();

  await expect(page.getByText("Thank you, we will reply within two days.")).toBeVisible();
  const [submission] = await submissionsOf(api, form.id);
  expect(submission).toMatchObject({
    submissionData: [
      { field: "name", value: "Asha Ramdin" },
      { field: "email", value: "asha@example.mu" },
      { field: "topic", value: "retreats" },
      { field: "country", value: "Mauritius (MU)" },
      { field: "message", value: "Is there space on the next retreat?" },
      { field: "consent", value: "Yes" },
    ],
  });
});

test("a visitor signs up through a newsletter form", async ({ api, page }) => {
  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thanks."]),
    confirmationType: "message",
    fields: [{ blockType: "email", label: "Email address", name: "email", required: true }],
    title: unique("Newsletter"),
  });
  const slug = unique("newsletter-page");
  await api.create("pages", {
    _status: "published",
    layout: [{ blockType: "newsletter", signupForm: form.id }],
    slug,
    title: "Stay in touch",
  });

  const element = await visit(page, `/${slug}`);
  await element.getByRole("textbox", { name: "Email address" }).fill("ada@example.com");
  await element.getByRole("button", { name: "Subscribe" }).click();

  await expect(page.getByText("Thank you. You will hear from us soon.")).toBeVisible();
  expect(await submissionsOf(api, form.id)).toMatchObject([
    { submissionData: [{ field: "email", value: "ada@example.com" }] },
  ]);
});

test("a sign-up recovers after the Turnstile script fails to load", async ({ api, page }) => {
  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thanks."]),
    confirmationType: "message",
    fields: [{ blockType: "email", label: "Email address", name: "email", required: true }],
    title: unique("Offline"),
  });
  const slug = unique("offline-page");
  await api.create("pages", {
    _status: "published",
    layout: [{ blockType: "newsletter", signupForm: form.id }],
    slug,
    title: "Patchy connection",
  });
  let blocked = false;
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) => {
    if (blocked) return route.continue();
    blocked = true;
    return route.abort();
  });

  const element = await visit(page, `/${slug}`);
  await element.getByRole("textbox", { name: "Email address" }).fill("patchy@example.com");
  await element.getByRole("button", { name: "Subscribe" }).click();
  await expect(element.getByRole("alert")).toHaveText("Something went wrong. Please try again.");

  await element.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByText("Thank you. You will hear from us soon.")).toBeVisible();
  expect(await submissionsOf(api, form.id)).toMatchObject([
    { submissionData: [{ field: "email", value: "patchy@example.com" }] },
  ]);
});

test("a form that no published page offers refuses submissions", async ({ api, page }) => {
  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thanks."]),
    confirmationType: "message",
    fields: [{ blockType: "email", label: "Email address", name: "email", required: true }],
    title: unique("Withdrawn"),
  });
  const slug = unique("withdrawn-page");
  const offering = await api.create("pages", {
    _status: "published",
    layout: [{ blockType: "newsletter", signupForm: form.id }],
    slug,
    title: "Soon withdrawn",
  });

  const element = await visit(page, `/${slug}`);
  await api.update("pages", offering.id, { layout: [] });
  await element.getByRole("textbox", { name: "Email address" }).fill("late@example.com");
  await element.getByRole("button", { name: "Subscribe" }).click();

  await expect(element.getByRole("alert")).toHaveText(
    "Sign-ups are closed. Reload the page to see the latest details.",
  );
  expect(await submissionsOf(api, form.id)).toEqual([]);
});

test("visitors can't create form submissions through the API", async ({ anonymous, api }) => {
  const form = await api.create("forms", {
    confirmationMessage: lexical(["Thanks."]),
    confirmationType: "message",
    fields: [{ blockType: "email", label: "Email address", name: "email", required: true }],
    title: unique("Closed to the API"),
  });

  const response = await anonymous.request.post("/api/form-submissions", {
    data: { form: form.id, submissionData: [{ field: "email", value: "spam@example.com" }] },
  });
  expect(response.status()).toBe(403);
});

test.describe("submitForm called directly", () => {
  test("drops a key that the form has no field for", async ({ anonymous, api }) => {
    const form = await offeredForm(api);

    const outcome = await callServerFn(anonymous.request, submitForm, {
      form: form.id,
      turnstileToken,
      values: { email: "ada@example.com", isAdmin: true, topic: "courses" },
    });

    expect(outcome).toEqual({ result: { status: "sent" } });
    const [submission] = await submissionsOf(api, form.id);
    expect(submission?.submissionData).toEqual([
      expect.objectContaining({ field: "email", value: "ada@example.com" }),
      expect.objectContaining({ field: "topic", value: "courses" }),
    ]);
  });

  test("refuses a select value that the form doesn't offer", async ({ anonymous, api }) => {
    const form = await offeredForm(api);

    const outcome = await callServerFn(anonymous.request, submitForm, {
      form: form.id,
      turnstileToken,
      values: { email: "ada@example.com", topic: "<script>" },
    });

    expect(outcome).toEqual({
      result: { errors: { topic: "Choose one of the options." }, status: "invalid" },
    });
    expect(await submissionsOf(api, form.id)).toEqual([]);
  });

  test("refuses an empty required field", async ({ anonymous, api }) => {
    const form = await offeredForm(api);

    const outcome = await callServerFn(anonymous.request, submitForm, {
      form: form.id,
      turnstileToken,
      values: { email: "  ", topic: "courses" },
    });

    expect(outcome).toEqual({
      result: { errors: { email: "This field is required." }, status: "invalid" },
    });
    expect(await submissionsOf(api, form.id)).toEqual([]);
  });

  test("refuses a form that no page offers", async ({ anonymous, api }) => {
    const form = await api.create("forms", {
      confirmationMessage: lexical(["Thanks."]),
      confirmationType: "message",
      fields: [{ blockType: "email", label: "Email", name: "email", required: true }],
      title: unique("Never shown"),
    });

    const outcome = await callServerFn(anonymous.request, submitForm, {
      form: form.id,
      turnstileToken,
      values: { email: "ada@example.com" },
    });

    expect(outcome).toEqual({ result: { status: "refused" } });
    expect(await submissionsOf(api, form.id)).toEqual([]);
  });

  test("refuses a submission that another site's page sends", async ({ anonymous, api }) => {
    const form = await api.create("forms", {
      confirmationMessage: lexical(["Thanks."]),
      confirmationType: "message",
      fields: [{ blockType: "email", label: "Email", name: "email", required: true }],
      title: unique("Cross-site"),
    });

    const response = await postServerFn(
      anonymous.request,
      submitForm,
      { form: form.id, turnstileToken, values: { email: "ada@example.com" } },
      "cross-site",
    );

    expect(response.status()).toBe(403);
    expect(await submissionsOf(api, form.id)).toEqual([]);
  });

  test("answers input it can't parse with a generic error", async ({ anonymous }) => {
    const outcome = await callServerFn(anonymous.request, submitForm, {
      form: { id: 1 },
      values: "everything",
    });

    expect(outcome).toEqual({ error: new Error("The server could not complete the request.") });
  });
});
