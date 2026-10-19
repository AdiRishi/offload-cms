import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { SignUpForm } from "@/components/accounts/sign-up-form";

export const Route = createFileRoute("/_frontend/sign-up")({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (context.account) throw redirect({ to: "/account" });
  },
  component: SignUpPage,
  head: () => ({ meta: [{ title: "Create an account" }] }),
});

function SignUpPage() {
  const { returnTo } = Route.useSearch();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <SignUpForm returnTo={returnTo} />
    </main>
  );
}
