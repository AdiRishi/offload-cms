"use client";

import { useCart, usePayments } from "@payloadcms/plugin-ecommerce/client/react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const initiated = z.object({ reference: z.string(), paymentZone: z.string() });

const refusal = z.object({ message: z.string() });

/** The plugin's provider throws the endpoint's response text, whose message is for the customer. */
const messageOf = (error: unknown) => {
  try {
    return error instanceof Error ? refusal.parse(JSON.parse(error.message)).message : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Where the payment zone keeps a guest's email for the return page, which confirms the order
 * after mIPS sends the customer back. The tab keeps it until it closes.
 */
export const mipsCustomerEmailKey = (reference: string) => `mips:${reference}:customerEmail`;

/**
 * Rebuilds mIPS's payment zone from the elements the site trusts: scripts and iframes loaded from
 * `origins`. Everything else in the gateway's HTML, including inline scripts, is dropped, so a
 * Content-Security-Policy of `script-src` and `frame-src` on those origins is enough.
 */
/** The absolute URL in `src`, or `undefined`. `URL.parse` would need Safari 18. */
const absoluteURL = (src: string) => {
  try {
    return new URL(src);
  } catch {
    return undefined;
  }
};

const trustedZone = (html: string, origins: readonly string[]) => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return [...parsed.querySelectorAll("script, iframe")].flatMap(
    (source): (HTMLScriptElement | HTMLIFrameElement)[] => {
      const url = absoluteURL(source.getAttribute("src") ?? "");
      if (!url || !origins.includes(url.origin)) return [];
      if (source.tagName === "SCRIPT") {
        const script = document.createElement("script");
        script.src = url.href;
        return [script];
      }
      const iframe = document.createElement("iframe");
      iframe.src = url.href;
      iframe.title = source.getAttribute("title") || "mIPS payment";
      iframe.width = source.getAttribute("width") ?? "450";
      iframe.height = source.getAttribute("height") ?? "508";
      iframe.className = "max-w-full border-0";
      return [iframe];
    },
  );
};

/** mIPS's payment zone host. */
const mipsOrigins = ["https://go.mips.mu"];

/**
 * Pays for the cart with mIPS. The button creates an mIPS order for the cart and shows mIPS's
 * payment zone, an iframe and a script from `origins`. After a successful payment, mIPS sends the
 * customer to the adapter's `returnURL`. Pass `customerEmail` for a guest. A logged-in customer's
 * order uses their account's email.
 */
export function MipsPaymentZone({
  customerEmail,
  disabled,
  origins = mipsOrigins,
}: {
  customerEmail?: string;
  disabled?: boolean;
  /** The origins whose scripts and iframes the payment zone may load. */
  origins?: readonly string[];
}) {
  const { initiatePayment } = usePayments();
  const { refreshCart } = useCart();
  const zone = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "shown">("idle");
  const [problem, setProblem] = useState<string>();

  const start = async () => {
    setState("loading");
    setProblem(undefined);
    try {
      const { reference, paymentZone } = initiated.parse(
        await initiatePayment("mips", { additionalData: { customerEmail } }),
      );
      const elements = trustedZone(paymentZone, origins);
      if (!elements.some((element) => element instanceof HTMLIFrameElement)) {
        throw new Error("The payment zone has no iframe from a trusted origin.");
      }
      if (customerEmail) sessionStorage.setItem(mipsCustomerEmailKey(reference), customerEmail);
      zone.current?.replaceChildren(...elements);
      setState("shown");
    } catch (error) {
      // A refused start can mean the prices changed. The cart then holds the new total.
      await refreshCart();
      setProblem(messageOf(error) ?? "We could not start the payment. Please try again.");
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {state === "shown" ? null : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || state === "loading"}
          onClick={() => void start()}
        >
          {state === "loading" ? <Spinner /> : null}
          Pay by card with mIPS
        </Button>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div ref={zone} />
    </div>
  );
}
