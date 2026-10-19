"use client";

import type { VerifyEmailResult as Result } from "@adirishi/offload-accounts";

import { Link } from "@tanstack/react-router";

/** What happened to the link in a verification email, from `verifyEmail` in the route's loader. */
export function VerifyEmailResult({ result }: { result: Result }) {
  if (result.status === "verified") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2">
        <p className="font-medium">Your email is verified</p>
        <p className="text-sm text-muted-foreground">
          <Link to="/login" className="underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>
    );
  }
  if (result.status === "invalid") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2">
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
    <div className="flex w-full max-w-sm flex-col gap-2">
      <p className="font-medium">We could not verify your email</p>
      <p className="text-sm text-muted-foreground">
        Something went wrong. Reload the page to try again.
      </p>
    </div>
  );
}
