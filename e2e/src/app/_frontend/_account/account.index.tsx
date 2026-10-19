import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_frontend/_account/account/")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Your account" }] }),
});

function AccountPage() {
  const { account } = Route.useRouteContext();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Your account</h1>
      <p>Logged in as {account.name || account.email}.</p>
      <Link to="/account/bookings" className="underline">
        Your bookings
      </Link>
    </main>
  );
}
