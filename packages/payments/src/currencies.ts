import type { Currency } from "@payloadcms/plugin-ecommerce/types";

/** The Mauritian rupee. Prices are stored in cents. */
export const MUR: Currency = {
  code: "MUR",
  decimals: 2,
  label: "Mauritian Rupee",
  symbol: "Rs",
  symbolDisplay: "code",
};

/** The Indian rupee. Prices are stored in paise. */
export const INR: Currency = {
  code: "INR",
  decimals: 2,
  label: "Indian Rupee",
  symbol: "₹",
};
