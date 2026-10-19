import type { PaymentAdapterClient } from "@payloadcms/plugin-ecommerce/types";

/** The Razorpay payment method for `EcommerceProvider`'s `paymentMethods`. */
export const razorpayAdapterClient = ({ label = "Razorpay" }: { label?: string } = {}) =>
  ({
    name: "razorpay",
    label,
    initiatePayment: true,
    confirmOrder: true,
  }) satisfies PaymentAdapterClient;

/** The mIPS payment method for `EcommerceProvider`'s `paymentMethods`. */
export const mipsAdapterClient = ({ label = "Card (mIPS)" }: { label?: string } = {}) =>
  ({
    name: "mips",
    label,
    initiatePayment: true,
    confirmOrder: true,
  }) satisfies PaymentAdapterClient;
