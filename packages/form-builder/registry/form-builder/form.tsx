import type { DataFromCollectionSlug } from "payload";

import { RichText } from "@payloadcms/richtext-lexical/react";

import {
  type ClientField,
  type Confirmation,
  FormBuilderFormClient,
} from "@/components/form-builder/form-client";

/**
 * A form built in the form builder. Rich text, in message fields and the confirmation message,
 * renders here on the server and reaches the client form as React nodes.
 */
export function FormBuilderForm({ form }: { form: DataFromCollectionSlug<"forms"> }) {
  const fields = (form.fields ?? []).map((field, index): ClientField =>
    field.blockType === "message"
      ? {
          blockType: "message",
          id: field.id ?? String(index),
          message: field.message ? <RichText data={field.message} /> : null,
        }
      : field,
  );
  const confirmation: Confirmation =
    form.confirmationType === "redirect" && form.redirect?.url
      ? { type: "redirect", url: form.redirect.url }
      : {
          type: "message",
          message: form.confirmationMessage ? (
            <RichText data={form.confirmationMessage} />
          ) : (
            <p>Thank you. We have received your message.</p>
          ),
        };

  return (
    <FormBuilderFormClient
      id={form.id}
      fields={fields}
      submitLabel={form.submitButtonLabel || "Send"}
      confirmation={confirmation}
    />
  );
}
