import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { LoginForm } from "@/components/accounts/login-form";

export const Route = createFileRoute("/_frontend/login")({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (context.account) throw redirect({ to: "/account" });
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Log in" }] }),
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <LoginForm returnTo={returnTo} />
    </main>
  );
}
