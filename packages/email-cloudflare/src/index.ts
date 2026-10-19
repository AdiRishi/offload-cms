import type { EmailAdapter, SendEmailOptions } from "payload";

import { Buffer } from "node:buffer";

export type CloudflareEmailAdapterArgs = {
  /** The Worker's `send_email` binding. */
  binding: SendEmail;
  defaultFromAddress: string;
  defaultFromName: string;
};

type Recipient = string | EmailAddress;
type Attachment = NonNullable<SendEmailOptions["attachments"]>[number];
type AddressField = "bcc" | "cc" | "from" | "replyTo" | "to";
type AddressValue = SendEmailOptions[AddressField] | null;

/**
 * Payload's message options, with the `null` addresses that Nodemailer accepts.
 * The form builder sends `from: null` and `replyTo: null` for an empty sender.
 */
type CloudflareEmailMessage = Omit<SendEmailOptions, AddressField> & {
  [Field in AddressField]?: AddressValue;
};

/**
 * Sends Payload's email through Cloudflare Email Service. The domain of every
 * `from` address must be onboarded to Email Sending.
 */
export const cloudflareEmailAdapter =
  ({ binding, defaultFromAddress, defaultFromName }: CloudflareEmailAdapterArgs) =>
  () =>
    ({
      name: "cloudflare-email",
      defaultFromAddress,
      defaultFromName,
      sendEmail: async (message: CloudflareEmailMessage) =>
        binding.send({
          from: single("from", message.from) ?? {
            email: defaultFromAddress,
            name: defaultFromName,
          },
          to: recipients(message.to) ?? [],
          cc: recipients(message.cc),
          bcc: recipients(message.bcc),
          replyTo: single("replyTo", message.replyTo),
          subject: message.subject ?? "",
          text: body("text", message.text),
          html: body("html", message.html),
          headers: headers(message.headers),
          attachments: message.attachments?.map(attachment),
        }),
    }) satisfies ReturnType<EmailAdapter<EmailSendResult>>;

// Splits a Nodemailer address list on the commas that sit outside quoted names and angle brackets.
const addressListPattern = /(?:"(?:[^"\\]|\\.)*"|<[^>]*>|[^,"<])+/gu;
const namedAddressPattern = /^(.*?)\s*<([^<>]+)>$/su;

const parseAddress = (value: string): Recipient => {
  const match = namedAddressPattern.exec(value);
  if (!match) return value;
  const [, name = "", email = ""] = match;
  const unquoted = /^"(.*)"$/su.exec(name)?.[1]?.replace(/\\(.)/gu, "$1") ?? name;
  return unquoted ? { email, name: unquoted } : email;
};

/** Returns undefined for an absent, `null`, or empty address list, as Nodemailer treats them. */
const recipients = (value: AddressValue): Recipient[] | undefined => {
  if (value === undefined || value === null) return undefined;
  const list = (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    if (typeof entry === "string") {
      return (entry.match(addressListPattern) ?? [])
        .map((part) => part.trim())
        .filter(Boolean)
        .map(parseAddress);
    }
    if (!entry.address) return [];
    return [entry.name ? { email: entry.address, name: entry.name } : entry.address];
  });
  return list.length > 0 ? list : undefined;
};

const single = (field: "from" | "replyTo", value: AddressValue) => {
  const list = recipients(value);
  if (list && list.length > 1) {
    throw new Error(`Cloudflare Email Service takes one ${field} address, not ${list.length}.`);
  }
  return list?.[0];
};

const body = (field: "html" | "text", value: SendEmailOptions["text"]) => {
  if (value === undefined || typeof value === "string") return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  throw new Error(`The email's ${field} must be a string or a Buffer, not a stream or a path.`);
};

const headers = (value: SendEmailOptions["headers"]) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value))
    return Object.fromEntries(value.map((entry) => [entry.key, entry.value]));
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry : Array.isArray(entry) ? entry.join(", ") : entry.value,
    ]),
  );
};

const attachmentBytes = ({ content, encoding, filename }: Attachment) => {
  if (typeof content === "string") {
    if (encoding !== undefined && !Buffer.isEncoding(encoding)) {
      throw new Error(`Attachment ${filename} has an unknown encoding, ${encoding}.`);
    }
    return new Uint8Array(Buffer.from(content, encoding));
  }
  if (content instanceof Uint8Array) return new Uint8Array(content);
  throw new Error(
    `Attachment ${filename} needs its content as a string or a Buffer. Cloudflare Email Service can't read streams, paths or URLs.`,
  );
};

const attachment = (value: Attachment): EmailAttachment => {
  const { cid, contentType, filename } = value;
  if (!filename) throw new Error("Cloudflare Email Service needs a filename on every attachment.");
  if (!contentType) {
    throw new Error(
      `Attachment ${filename} needs a contentType. Cloudflare Email Service doesn't infer it.`,
    );
  }
  const content = attachmentBytes(value);
  return cid
    ? { content, contentId: cid, disposition: "inline", filename, type: contentType }
    : { content, disposition: "attachment", filename, type: contentType };
};
