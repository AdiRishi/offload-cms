"use client";

import { changePasswordInput } from "@adirishi/offload-accounts";
import { revalidateLogic } from "@tanstack/react-form";
import { useHydrated } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { z } from "zod";

import { useAppForm } from "@/components/form-fields";
import { changePassword } from "@/server/account.functions";

const schema = changePasswordInput
  .extend({ passwordConfirmation: z.string() })
  .refine((value) => value.newPassword === value.passwordConfirmation, {
    error: "The passwords don't match.",
    path: ["passwordConfirmation"],
  });

const changeProblems = {
  invalid: "Your current password is wrong.",
  limited: "Too many attempts from your connection. Please wait a minute and try again.",
  "signed-out": "You were logged out. Log in again to change your password.",
  error: "Something went wrong. Please try again.",
};

/**
 * Changes the logged-in account's password after checking the current one. The visitor stays
 * logged in here, and the account's other sessions end.
 */
export function ChangePasswordForm() {
  const send = useServerFn(changePassword);
  const hydrated = useHydrated();
  const element = useRef<HTMLFormElement>(null);
  const [changed, setChanged] = useState(false);

  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "", passwordConfirmation: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      onSubmitAsync: async ({ value: { currentPassword, newPassword } }) => {
        try {
          const result = await send({ data: { currentPassword, newPassword } });
          return result.status === "changed" ? undefined : changeProblems[result.status];
        } catch {
          return changeProblems.error;
        }
      },
    },
    onSubmitInvalid: () => {
      // The fields mark themselves invalid on the next render.
      requestAnimationFrame(() =>
        element.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: () => setChanged(true),
  });

  if (changed) {
    return (
      <div
        role="status"
        tabIndex={-1}
        ref={(node) => node?.focus()}
        className="flex w-full max-w-sm flex-col gap-2 outline-none"
      >
        <p className="font-medium">Your password is changed</p>
        <p className="text-sm text-muted-foreground">
          Your other devices are logged out. Log in there with the new password.
        </p>
      </div>
    );
  }

  return (
    // A submit before hydration posts back to the page instead of putting the passwords in the URL.
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
      <form.AppField name="currentPassword">
        {(field) => (
          <field.TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppField name="newPassword">
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
        <form.SubmitButton>Change password</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
