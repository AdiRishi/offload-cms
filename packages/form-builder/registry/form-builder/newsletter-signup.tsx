"use client";

import {
  defaultValues,
  type FormField,
  formSchema,
  type InputField,
  isInputField,
} from "@adirishi/offload-form-builder";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useHydrated } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useId, useMemo, useRef, useState } from "react";

import { Turnstile, type TurnstileHandle } from "@/components/form-builder/turnstile";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { submitForm } from "@/server/forms.functions";

const signupProblems = {
  invalid: "Enter a valid email address.",
  unverified: "We could not confirm you are not a robot. Please try again.",
  limited: "Too many sign-ups from your connection. Please wait a minute and try again.",
  refused: "Sign-ups are closed. Reload the page to see the latest details.",
  error: "Something went wrong. Please try again.",
};

/**
 * A one-line sign-up for a form-builder form whose answer is an email field, such as a
 * newsletter. Submissions save like any other form's.
 */
export function NewsletterSignup({
  form,
}: {
  form: { id: number | string; fields?: readonly FormField[] | null };
}) {
  const send = useServerFn(submitForm);
  const hydrated = useHydrated();
  const id = useId();
  const turnstile = useRef<TurnstileHandle>(null);
  const [engaged, setEngaged] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const emailField = form.fields?.filter(isInputField).find((field) => field.blockType === "email");
  const name = emailField?.name ?? "email";
  // The form's other fields must be optional, because the sign-up sends only the email address.
  const fields = useMemo(
    (): InputField[] => [{ blockType: "email", name, required: true }],
    [name],
  );
  const schema = useMemo(() => formSchema(fields), [fields]);

  const signup = useForm({
    defaultValues: defaultValues(fields),
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      onSubmitAsync: async ({ value }) => {
        try {
          if (!turnstile.current || !emailField) throw new Error("The form cannot submit.");
          const turnstileToken = await turnstile.current.token();
          const result = await send({ data: { form: form.id, values: value, turnstileToken } });
          turnstile.current.reset();
          return result.status === "sent" ? undefined : signupProblems[result.status];
        } catch {
          turnstile.current?.reset();
          return signupProblems.error;
        }
      },
    },
    onSubmit: () => setSubscribed(true),
  });

  if (subscribed) {
    return (
      <p role="status" tabIndex={-1} ref={(node) => node?.focus()} className="outline-none">
        Thank you. You will hear from us soon.
      </p>
    );
  }

  return (
    // A submit before hydration posts back to the page instead of putting the answers in the URL.
    <form
      method="post"
      data-hydrated={hydrated || undefined}
      noValidate
      className="flex max-w-md flex-col gap-3"
      onFocus={() => setEngaged(true)}
      onPointerDown={() => setEngaged(true)}
      onSubmit={(event) => {
        event.preventDefault();
        void signup.handleSubmit();
      }}
    >
      <signup.Field name={name}>
        {(field) => (
          <>
            <label htmlFor={id} className="sr-only">
              {emailField?.label || "Email address"}
            </label>
            <InputGroup>
              <InputGroupInput
                id={id}
                name={field.name}
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={typeof field.state.value === "string" ? field.state.value : ""}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={!field.state.meta.isValid}
                aria-describedby={`${id}-error`}
              />
              <InputGroupAddon align="inline-end">
                <signup.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                      {isSubmitting ? <Spinner /> : null}
                      Subscribe
                    </Button>
                  )}
                </signup.Subscribe>
              </InputGroupAddon>
            </InputGroup>
            <div id={`${id}-error`}>
              <FieldError errors={field.state.meta.errors} />
              <signup.Subscribe selector={(state) => state.errorMap.onSubmit}>
                {(error) =>
                  typeof error === "string" ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null
                }
              </signup.Subscribe>
            </div>
          </>
        )}
      </signup.Field>
      {engaged ? <Turnstile ref={turnstile} action="newsletter" /> : null}
    </form>
  );
}
