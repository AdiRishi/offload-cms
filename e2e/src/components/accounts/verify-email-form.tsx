"use client";

import type { VerifyEmailResult } from "@adirishi/offload-accounts";

import { Link, useHydrated } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { verifyEmail } from "@/server/account.functions";

/**
 * Verifies the email of the link in a verification email when the visitor presses the button.
 * Opening the page changes nothing, because mail scanners open the links in emails.
 */
export function VerifyEmailForm({ token }: { token: string }) {
  const send = useServerFn(verifyEmail);
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<VerifyEmailResult>();

  const confirm = async () => {
    setPending(true);
    try {
      setResult(await send({ data: { token } }));
    } catch {
      setResult({ status: "error" });
    } finally {
      setPending(false);
    }
  };

  if (result?.status === "verified") {
    return (
      <div role="status" className="flex w-full max-w-sm flex-col gap-2">
        <p className="font-medium">Your email is verified</p>
        <p className="text-sm text-muted-foreground">
          <Link to="/login" className="underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>
    );
  }
  if (result?.status === "invalid" || !token) {
    return (
      <div role="status" className="flex w-full max-w-sm flex-col gap-2">
        <p className="font-medium">This link is not valid</p>
        <p className="text-sm text-muted-foreground">
          It may have been used already. If you verified your email before,{" "}
          <Link to="/login" className="underline underline-offset-4">
            log in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    // A submit before hydration posts back to the page instead of verifying.
    <form
      method="post"
      data-hydrated={hydrated || undefined}
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-sm text-muted-foreground">
        Confirm that this email address is yours to finish creating your account.
      </p>
      {result?.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          Something went wrong. Please try again.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? <Spinner /> : null}
        Confirm email address
      </Button>
    </form>
  );
}
