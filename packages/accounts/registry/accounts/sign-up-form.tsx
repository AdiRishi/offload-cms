"use client";

import { signUpInput } from "@adirishi/offload-accounts";
import { revalidateLogic } from "@tanstack/react-form";
import { Link, useHydrated, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { z } from "zod";

import { Turnstile, type TurnstileHandle } from "@/components/form-builder/turnstile";
import { useAppForm } from "@/components/form-fields";
import { signUp } from "@/server/account.functions";

const schema = signUpInput
  .pick({ email: true, password: true })
  .extend({ passwordConfirmation: z.string() })
  .refine((value) => value.password === value.passwordConfirmation, {
    error: "The passwords don't match.",
    path: ["passwordConfirmation"],
  });

const signUpProblems = {
  unverified: "We could not confirm you are not a robot. Please try again.",
  error: "Something went wrong. Please try again.",
};

/**
 * Creates an account. When the site verifies email addresses, or the email already has an
 * account, it asks the visitor to check their email. Otherwise it logs the visitor in and goes to
 * `returnTo`.
 */
export function SignUpForm({ returnTo }: { returnTo?: string }) {
  const send = useServerFn(signUp);
  const hydrated = useHydrated();
  const router = useRouter();
  const navigate = useNavigate();
  const turnstile = useRef<TurnstileHandle>(null);
  const element = useRef<HTMLFormElement>(null);
  const [engaged, setEngaged] = useState(false);
  const [emailedTo, setEmailedTo] = useState<string>();

  const form = useAppForm({
    defaultValues: { email: "", password: "", passwordConfirmation: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      onSubmitAsync: async ({ value: { email, password } }) => {
        try {
          if (!turnstile.current) throw new Error("Turnstile has not rendered.");
          const turnstileToken = await turnstile.current.token();
          const result = await send({ data: { email, password, turnstileToken, returnTo } });
          turnstile.current.reset();
          switch (result.status) {
            case "signed-in":
              await router.invalidate();
              await navigate({ href: result.returnTo });
              return undefined;
            case "check-email":
              setEmailedTo(email.trim());
              return undefined;
            case "invalid":
              return {
                form: "Some answers need another look.",
                fields: Object.fromEntries(
                  Object.entries(result.errors).map(([name, message]) => [name, { message }]),
                ),
              };
            default:
              return signUpProblems[result.status];
          }
        } catch {
          turnstile.current?.reset();
          return signUpProblems.error;
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

  // The same message whether or not the email already had an account.
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
          We sent an email to {emailedTo}. Follow the link in it to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* A submit before hydration posts back to the page instead of putting the password in the URL. */}
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
          {(field) => <field.TextField label="Email" type="email" autoComplete="username" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              description="At least 8 characters."
            />
          )}
        </form.AppField>
        <form.AppField name="passwordConfirmation">
          {(field) => (
            <field.TextField label="Confirm password" type="password" autoComplete="new-password" />
          )}
        </form.AppField>
        <form.AppForm>
          {engaged ? <Turnstile ref={turnstile} action="sign-up" /> : null}
          <form.FormError />
          <form.SubmitButton>Sign up</form.SubmitButton>
        </form.AppForm>
      </form>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" search={{ returnTo }} className="underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
