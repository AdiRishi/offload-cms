import assert from "node:assert/strict";
import { test } from "node:test";

import { cloudflareEmailAdapter } from "./index.ts";

const sendThroughAdapter = () => {
  const sent: EmailMessageBuilder[] = [];
  const binding: SendEmail = {
    send: async (message: EmailMessage | EmailMessageBuilder) => {
      if (!("subject" in message)) throw new Error("The adapter sent a raw EmailMessage.");
      sent.push(message);
      return { messageId: "<sent@example.com>" };
    },
  };
  const { sendEmail } = cloudflareEmailAdapter({
    binding,
    defaultFromAddress: "noreply@example.com",
    defaultFromName: "Example CMS",
  })();
  return { sendEmail, sent };
};

test("sends Payload's password reset email with the named sender it formats", async () => {
  const { sendEmail, sent } = sendThroughAdapter();

  await sendEmail({
    from: '"Example CMS" <noreply@example.com>',
    to: "editor@example.com",
    subject: "Reset your password",
    html: "<p>Reset it here.</p>",
  });

  assert.deepEqual(sent[0], {
    from: { email: "noreply@example.com", name: "Example CMS" },
    to: ["editor@example.com"],
    cc: undefined,
    bcc: undefined,
    replyTo: undefined,
    subject: "Reset your password",
    text: undefined,
    html: "<p>Reset it here.</p>",
    headers: undefined,
    attachments: undefined,
  });
});

test("splits an address list only on commas outside quoted names", async () => {
  const { sendEmail, sent } = sendThroughAdapter();

  await sendEmail({ to: '"Doe, Jane" <jane@example.com>, sam@example.com', subject: "Report" });

  assert.deepEqual(sent[0]?.to, [
    { email: "jane@example.com", name: "Doe, Jane" },
    "sam@example.com",
  ]);
});

test("sends attachment content as bytes, with an inline image keyed by cid", async () => {
  const { sendEmail, sent } = sendThroughAdapter();

  await sendEmail({
    to: "editor@example.com",
    subject: "Export",
    attachments: [
      { filename: "posts.csv", content: "title", contentType: "text/csv" },
      {
        filename: "logo.png",
        content: "iVBORw==",
        encoding: "base64",
        contentType: "image/png",
        cid: "logo",
      },
    ],
  });

  assert.deepEqual(sent[0]?.attachments, [
    {
      content: new TextEncoder().encode("title"),
      disposition: "attachment",
      filename: "posts.csv",
      type: "text/csv",
    },
    {
      content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      contentId: "logo",
      disposition: "inline",
      filename: "logo.png",
      type: "image/png",
    },
  ]);
});
