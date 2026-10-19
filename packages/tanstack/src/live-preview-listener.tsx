"use client";

import { RefreshRouteOnSave } from "@payloadcms/live-preview-react";
import { useRouter } from "@tanstack/react-router";

/**
 * Refreshes the route's loaders when an editor saves in the admin's Live Preview. Render it on
 * pages that serve drafts, while the request is a draft. The admin and the site share one
 * Worker, so the admin's origin is the page's own.
 */
export const LivePreviewListener = () => {
  const router = useRouter();
  // The origin matters only in the browser, where the listener checks each message against it.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return <RefreshRouteOnSave refresh={() => void router.invalidate()} serverURL={origin} />;
};
