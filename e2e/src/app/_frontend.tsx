/// <reference types="vite/client" />

import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AccountMenu } from "@/components/accounts/account-menu";
import { getAccount } from "@/server/account.functions";

import styles from "./_frontend/styles.css?url";
// The form components call submitForm only from components that server components render, which
// the build doesn't follow. Importing it here registers it for every page under this layout.
// oxlint-disable-next-line import/no-unassigned-import
import "@/server/forms.functions";

export const Route = createFileRoute("/_frontend")({
  beforeLoad: async () => ({ account: await getAccount() }),
  component: FrontendLayout,
  head: () => ({
    links: [{ rel: "stylesheet", href: styles }],
  }),
});

function FrontendLayout() {
  const { account } = Route.useRouteContext();
  return (
    <>
      <header className="flex justify-end p-4">
        <AccountMenu account={account} />
      </header>
      <Outlet />
    </>
  );
}
