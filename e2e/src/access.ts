import type { Access, PayloadRequest } from "payload";

/**
 * Staff are users with the `admin` role. A `customer` logs in to the site but not the admin, like
 * the customers of Payload's ecommerce template.
 */
export const isStaff = ({ req }: { req: PayloadRequest }) => req.user?.role === "admin";

/** Anyone can read published documents. Staff can also read drafts. */
export const publishedOrStaff: Access = ({ req }) =>
  isStaff({ req }) || { _status: { equals: "published" } };

/** A logged-in user who isn't staff. */
export const isCustomer = ({ req }: { req: PayloadRequest }) => req.user?.role === "customer";

/** Staff see every document. A customer sees the documents whose `customer` is them. */
export const isDocumentOwner: Access = ({ req }) => {
  if (isStaff({ req })) return true;
  return req.user ? { customer: { equals: req.user.id } } : false;
};
