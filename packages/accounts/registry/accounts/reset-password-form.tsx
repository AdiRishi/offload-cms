"use client";

import { resetPasswordInput } from "@adirishi/offload-accounts";
import { revalidateLogic } from "@tanstack/react-form";
import { Link, useHydrated, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { z } from "zod";

import { useAppForm } from "@/components/form-fields";
import { resetPassword } from "@/server/account.functions";

const schema = resetPasswordInput
  .pick({ password: true })
  .extend({ passwordConfirmation: z.string() })
  .refine((value) => value.password === value.passwordConfirmation, {
    error: "The passwords don't match.",
    path: ["passwordConfirmation"],
  });

/**
 * Sets a new password with the token from a reset email, then logs the visitor in and goes to
 * the account page.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const send = useServerFn(resetPassword);
  const hydrated = useHydrated();
  const router = useRouter();
  const navigate = useNavigate();
  const element = useRef<HTMLFormElement>(null);
  const [expired, setExpired] = useState(false);

  const form = useAppForm({
    defaultValues: { password: "", passwordConfirmation: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      onSubmitAsync: async ({ value: { password } }) => {
        try {
          const result = await send({ data: { token, password } });
          if (result.status === "error") return "Something went wrong. Please try again.";
          if (result.status !== "signed-in") {
            setExpired(true);
            return undefined;
          }
          await router.invalidate();
          await navigate({ href: result.returnTo });
          return undefined;
        } catch {
          return "Something went wrong. Please try again.";
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

  if (expired) {
    return (
      <div
        role="status"
        tabIndex={-1}
        ref={(node) => node?.focus()}
        className="flex w-full max-w-sm flex-col gap-2 outline-none"
      >
        <p className="font-medium">This link has expired or was already used</p>
        <p className="text-sm text-muted-foreground">
          <Link to="/forgot-password" className="underline underline-offset-4">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    // A submit before hydration posts back to the page instead of putting the password in the URL.
    <form
      method="post"
      data-hydrated={hydrated || undefined}
      ref={element}
      noValidate
      className="flex w-full max-w-sm flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="New password"
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
        <form.FormError />
        <form.SubmitButton>Set password</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
