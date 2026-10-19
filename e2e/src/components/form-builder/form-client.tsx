"use client";

import {
  defaultValues,
  formSchema,
  type InputField,
  isInputField,
} from "@adirishi/offload-form-builder";
import { revalidateLogic } from "@tanstack/react-form";
import { useHydrated, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type ReactNode, useMemo, useRef, useState } from "react";

import { useAppForm } from "@/components/form-builder/fields";
import { Turnstile, type TurnstileHandle } from "@/components/form-builder/turnstile";
import { submitForm } from "@/server/forms.functions";

export type ClientField =
  | (InputField & { id?: string | null })
  | { blockType: "message"; id: string; message: ReactNode };

export type Confirmation =
  | { type: "message"; message: ReactNode }
  | { type: "redirect"; url: string };

/** Short answers pair up on wider screens. Long answers and checkboxes take the full row. */
const fieldSpan = (field: InputField) =>
  field.blockType === "textarea" || field.blockType === "checkbox"
    ? "col-span-12"
    : "col-span-12 sm:col-span-6";

const submissionProblems = {
  unverified: "We could not confirm you are not a robot. Please try again.",
  limited: "Too many messages from your connection. Please wait a minute and try again.",
  refused: "This form is no longer taking answers. Reload the page to see the latest details.",
  error: "Something went wrong. Please try again.",
};

export function FormBuilderFormClient({
  id,
  fields,
  submitLabel,
  confirmation,
}: {
  id: number | string;
  fields: ClientField[];
  submitLabel: string;
  confirmation: Confirmation;
}) {
  const send = useServerFn(submitForm);
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const turnstile = useRef<TurnstileHandle>(null);
  const element = useRef<HTMLFormElement>(null);
  const [engaged, setEngaged] = useState(false);
  const [sent, setSent] = useState(false);
  const inputs = useMemo(() => fields.filter(isInputField), [fields]);
  const schema = useMemo(() => formSchema(inputs), [inputs]);

  const form = useAppForm({
    defaultValues: defaultValues(inputs),
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      // The server validates the answers again and saves them in the same request, because a
      // Turnstile token passes only once.
      onSubmitAsync: async ({ value }) => {
        try {
          if (!turnstile.current) throw new Error("Turnstile has not rendered.");
          const turnstileToken = await turnstile.current.token();
          const result = await send({ data: { form: id, values: value, turnstileToken } });
          turnstile.current.reset();
          if (result.status === "invalid") {
            return {
              form: "Some answers need another look.",
              fields: Object.fromEntries(
                Object.entries(result.errors).map(([name, message]) => [name, { message }]),
              ),
            };
          }
          return result.status === "sent" ? undefined : submissionProblems[result.status];
        } catch {
          turnstile.current?.reset();
          return submissionProblems.error;
        }
      },
    },
    onSubmitInvalid: () => {
      // The fields mark themselves invalid on the next render.
      requestAnimationFrame(() =>
        element.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async () => {
      if (confirmation.type === "message") setSent(true);
      else if (confirmation.url.startsWith("/")) await navigate({ href: confirmation.url });
      else window.location.assign(confirmation.url);
    },
  });

  if (sent && confirmation.type === "message") {
    return (
      <div role="status" tabIndex={-1} ref={(node) => node?.focus()} className="outline-none">
        {confirmation.message}
      </div>
    );
  }

  return (
    // A submit before hydration posts back to the page instead of putting the answers in the URL.
    <form
      method="post"
      data-hydrated={hydrated || undefined}
      ref={element}
      noValidate
      className="grid grid-cols-12 gap-x-4 gap-y-6"
      onFocus={() => setEngaged(true)}
      onPointerDown={() => setEngaged(true)}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {fields.map((field) =>
        field.blockType === "message" ? (
          <div key={field.id} className="col-span-12">
            {field.message}
          </div>
        ) : (
          <div key={field.id ?? field.name} className={fieldSpan(field)}>
            <form.AppField name={field.name}>
              {(control) => {
                const label = field.label || field.name;
                switch (field.blockType) {
                  case "checkbox":
                    return <control.CheckboxField label={label} required={field.required} />;
                  case "country":
                    return <control.CountryField label={label} required={field.required} />;
                  case "email":
                    return (
                      <control.TextField
                        label={label}
                        required={field.required}
                        type="email"
                        autoComplete="email"
                      />
                    );
                  case "number":
                    return (
                      <control.TextField
                        label={label}
                        required={field.required}
                        inputMode="decimal"
                      />
                    );
                  case "select":
                    return (
                      <control.SelectField
                        label={label}
                        required={field.required}
                        placeholder={field.placeholder}
                        options={field.options ?? []}
                      />
                    );
                  case "state":
                    return (
                      <control.TextField
                        label={label}
                        required={field.required}
                        autoComplete="address-level1"
                      />
                    );
                  case "text":
                    return <control.TextField label={label} required={field.required} />;
                  case "textarea":
                    return <control.TextareaField label={label} required={field.required} />;
                }
              }}
            </form.AppField>
          </div>
        ),
      )}
      <form.AppForm>
        <div className="col-span-12 flex flex-col items-start gap-4">
          {engaged ? <Turnstile ref={turnstile} action="form" /> : null}
          <form.FormError />
          <form.SubmitButton>{submitLabel}</form.SubmitButton>
        </div>
      </form.AppForm>
    </form>
  );
}
