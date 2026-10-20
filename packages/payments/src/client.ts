import type {
  PaymentAdapterClient,
  PaymentAdapterClientArgs,
} from "@payloadcms/plugin-ecommerce/types";

/** The Razorpay payment method for `EcommerceProvider`'s `paymentMethods`. */
export const razorpayAdapterClient = ({ label = "Razorpay" }: PaymentAdapterClientArgs = {}) =>
  ({
    name: "razorpay",
    label,
    initiatePayment: true,
    confirmOrder: true,
  }) satisfies PaymentAdapterClient;

/** The mIPS payment method for `EcommerceProvider`'s `paymentMethods`. */
export const mipsAdapterClient = ({ label = "Card (mIPS)" }: PaymentAdapterClientArgs = {}) =>
  ({
    name: "mips",
    label,
    initiatePayment: true,
    confirmOrder: true,
  }) satisfies PaymentAdapterClient;

export { INR, MUR } from "./currencies.ts";
