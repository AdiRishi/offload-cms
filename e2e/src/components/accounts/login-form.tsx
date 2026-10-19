"use client";

import { logInInput } from "@adirishi/offload-accounts";
import { revalidateLogic } from "@tanstack/react-form";
import { Link, useHydrated, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";

import { useAppForm } from "@/components/form-fields";
import { logIn } from "@/server/account.functions";

const schema = logInInput.pick({ email: true, password: true });

const loginProblems = {
  invalid: "The email or password is wrong.",
  "email-unverified":
    "Verify your email with the link we sent you first. If you can't find it, reset your password.",
  locked: "Too many failed attempts. Try again later, or reset your password.",
  limited: "Too many attempts from your connection. Please wait a minute and try again.",
  error: "Something went wrong. Please try again.",
};

/**
 * Logs a visitor in, then goes to `returnTo`. The server sends the visitor to the account page
 * instead when `returnTo` is missing or leaves the site.
 */
export function LoginForm({ returnTo }: { returnTo?: string }) {
  const send = useServerFn(logIn);
  const hydrated = useHydrated();
  const router = useRouter();
  const navigate = useNavigate();
  const element = useRef<HTMLFormElement>(null);

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
      onSubmitAsync: async ({ value }) => {
        try {
          const result = await send({ data: { ...value, returnTo } });
          if (result.status !== "signed-in") return loginProblems[result.status];
          await router.invalidate();
          await navigate({ href: result.returnTo });
          return undefined;
        } catch {
          return loginProblems.error;
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

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* A submit before hydration posts back to the page instead of putting the password in the URL. */}
      <form
        method="post"
        data-hydrated={hydrated || undefined}
        ref={element}
        noValidate
        className="flex flex-col gap-6"
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
            <field.TextField label="Password" type="password" autoComplete="current-password" />
          )}
        </form.AppField>
        <form.AppForm>
          <form.FormError />
          <form.SubmitButton>Log in</form.SubmitButton>
        </form.AppForm>
      </form>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          <Link to="/forgot-password" className="underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
        <p>
          No account yet?{" "}
          <Link to="/sign-up" search={{ returnTo }} className="underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
