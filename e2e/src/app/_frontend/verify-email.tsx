import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { VerifyEmailResult } from "@/components/accounts/verify-email-result";
import { verifyEmail } from "@/server/account.functions";

export const Route = createFileRoute("/_frontend/verify-email")({
  validateSearch: z.object({ token: z.string().catch("") }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    deps.token ? verifyEmail({ data: { token: deps.token } }) : { status: "invalid" as const },
  component: VerifyEmailPage,
  head: () => ({ meta: [{ title: "Confirm your email address" }] }),
});

function VerifyEmailPage() {
  const result = Route.useLoaderData();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Confirm your email address</h1>
      <VerifyEmailResult result={result} />
    </main>
  );
}
