import { createFileRoute } from "@tanstack/react-router";

import { ChangePasswordForm } from "@/components/accounts/change-password-form";

export const Route = createFileRoute("/_frontend/_account/account/password")({
  component: ChangePasswordPage,
  head: () => ({ meta: [{ title: "Change your password" }] }),
});

function ChangePasswordPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Change your password</h1>
      <ChangePasswordForm />
    </main>
  );
}
