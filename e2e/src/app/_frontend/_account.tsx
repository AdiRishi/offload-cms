import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Pages for a logged-in customer. The guard only decides where the visitor goes. Each page's
 * server function checks the account again before it reads private data.
 */
export const Route = createFileRoute("/_frontend/_account")({
  beforeLoad: ({ context, location }) => {
    if (!context.account) {
      throw redirect({ to: "/login", search: { returnTo: location.href } });
    }
    return { account: context.account };
  },
  component: Outlet,
});
