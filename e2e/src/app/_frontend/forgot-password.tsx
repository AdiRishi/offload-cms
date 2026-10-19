import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordForm } from "@/components/accounts/forgot-password-form";

export const Route = createFileRoute("/_frontend/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Reset your password" }] }),
});

function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <ForgotPasswordForm />
    </main>
  );
}
