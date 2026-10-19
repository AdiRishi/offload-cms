import type { Block } from "payload";

// A config-level block, referenced by slug from pages and posts. It lives in its own module
// because a config reload in `vite dev` re-evaluates the config but not this module.
export const PullQuote: Block = {
  slug: "pullQuote",
  fields: [
    { name: "quote", type: "textarea", required: true },
    { name: "attribution", type: "text" },
  ],
};
