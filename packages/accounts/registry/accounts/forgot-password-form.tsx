"use client";

import { forgotPasswordInput } from "@adirishi/offload-accounts";
import { revalidateLogic } from "@tanstack/react-form";
import { Link, useHydrated } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Turnstile, type TurnstileHandle } from "@/components/form-builder/turnstile";
import { useAppForm } from "@/components/form-fields";
import { requestPasswordReset } from "@/server/account.functions";

const schema = forgotPasswordInput.pick({ email: true });

const resetProblems = {
  unverified: "We could not confirm you are not a robot. Please try again.",
  limited: "Too many requests from your connection. Please wait a minute and try again.",
  error: "Something went wrong. Please try again.",
};

/** Asks for an email address and sends it a link to reset the password. */
export function ForgotPasswordForm() {
  const send = useServerFn(requestPasswordReset);
  const hydrated = useHydrated();
  const turnstile = useRef<TurnstileHandle>(null);
  const element = useRef<HTMLFormElement>(null);
  const [engaged, setEngaged] = useState(false);
  const [emailedTo, setEmailedTo] = useState<string>();

  const form = useAppForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      onSubmitAsync: async ({ value: { email } }) => {
        try {
          if (!turnstile.current) throw new Error("Turnstile has not rendered.");
          const turnstileToken = await turnstile.current.token();
          const result = await send({ data: { email, turnstileToken } });
          turnstile.current.reset();
          if (result.status !== "sent") return resetProblems[result.status];
          setEmailedTo(email.trim());
          return undefined;
        } catch {
          turnstile.current?.reset();
          return resetProblems.error;
        }
      },
    },
    onSubmitInvalid: () => {
      // The fields mark themselves invalid on the next render.
      requestAnimationFrame(() =>
        element.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
  });

  // The message must not say whether the email has an account.
  if (emailedTo) {
    return (
      <div
        role="status"
        tabIndex={-1}
        ref={(node) => node?.focus()}
        className="flex w-full max-w-sm flex-col gap-2 outline-none"
      >
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          If {emailedTo} has an account, we sent it a link to reset the password.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* A submit before hydration posts back to the page instead of putting the answers in the URL. */}
      <form
        method="post"
        data-hydrated={hydrated || undefined}
        ref={element}
        noValidate
        className="flex flex-col gap-6"
        onFocus={() => setEngaged(true)}
        onPointerDown={() => setEngaged(true)}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" autoComplete="email" />}
        </form.AppField>
        <form.AppForm>
          {engaged ? <Turnstile ref={turnstile} action="forgot-password" /> : null}
          <form.FormError />
          <form.SubmitButton>Send reset link</form.SubmitButton>
        </form.AppForm>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link to="/login" className="underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
