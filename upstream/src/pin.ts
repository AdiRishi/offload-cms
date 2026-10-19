import { writeFileSync } from "node:fs";
import path from "node:path";

import pinFile from "../payload.json" with { type: "json" };

export type UpstreamPin = {
  commit: string;
  repository: string;
  /** Offload release number on top of `tag`; reset to 0 when the tag changes. */
  revision: number;
  tag: string;
};

export const pin: UpstreamPin = pinFile;

export const upstreamDir = path.resolve(import.meta.dirname, "..");
export const patchesDir = path.join(upstreamDir, "patches");
/** Payload at the pinned commit with the patches applied, created by `upstream checkout`. */
export const checkoutDir = path.join(upstreamDir, "payload");

export const writePin = (next: UpstreamPin) =>
  writeFileSync(path.join(upstreamDir, "payload.json"), `${JSON.stringify(next, null, 2)}\n`);

/** `v4.0.0-beta.2` at revision 3 releases as `4.0.0-beta.2-offload.3`. */
export const offloadVersion = `${pin.tag.replace(/^v/, "")}-offload.${pin.revision}`;

/** Published name for an upstream package: `payload` → `@adirishi/offload-payload`, `@payloadcms/ui` → `@adirishi/offload-ui`. */
export const offloadPackageName = (upstreamName: string) =>
  `@adirishi/offload-${upstreamName.replace(/^@payloadcms\//, "")}`;
