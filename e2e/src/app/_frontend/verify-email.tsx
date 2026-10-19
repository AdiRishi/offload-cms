import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { VerifyEmailForm } from "@/components/accounts/verify-email-form";

export const Route = createFileRoute("/_frontend/verify-email")({
  validateSearch: z.object({ token: z.string().catch("") }),
  component: VerifyEmailPage,
  head: () => ({ meta: [{ title: "Confirm your email address" }] }),
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Confirm your email address</h1>
      <VerifyEmailForm token={token} />
    </main>
  );
}
