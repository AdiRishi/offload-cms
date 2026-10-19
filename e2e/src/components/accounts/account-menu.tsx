"use client";

import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logOut } from "@/server/account.functions";

/** A header control: a log in link for a visitor, or a menu for a logged-in account. */
export function AccountMenu({
  account,
}: {
  account: { email: string; name?: string | null } | null;
}) {
  const end = useServerFn(logOut);
  const router = useRouter();
  const navigate = useNavigate();

  if (!account) {
    return (
      <Link to="/login" className={buttonVariants({ variant: "ghost" })}>
        Log in
      </Link>
    );
  }

  // Leave the page first, so that a page that needs an account doesn't redirect to the login page.
  const leave = async (everywhere: boolean) => {
    await end({ data: { everywhere } });
    await navigate({ to: "/" });
    await router.invalidate();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "ghost" })}>
        <span className="max-w-48 truncate">{account.name || account.email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {account.name ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{account.email}</DropdownMenuLabel>
          </DropdownMenuGroup>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void navigate({ to: "/account" })}>
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void leave(false)}>Log out</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void leave(true)}>Log out everywhere</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
