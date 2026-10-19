import type { Access } from "payload";

export const isStaff: Access = ({ req }) => Boolean(req.user);

/** Anyone can read published documents. Staff can also read drafts. */
export const publishedOrStaff: Access = ({ req }) =>
  Boolean(req.user) || { _status: { equals: "published" } };
