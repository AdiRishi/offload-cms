import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ResetPasswordForm } from "@/components/accounts/reset-password-form";

export const Route = createFileRoute("/_frontend/reset-password")({
  validateSearch: z.object({ token: z.string().catch("") }),
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Choose a new password" }] }),
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <ResetPasswordForm token={token} />
    </main>
  );
}
