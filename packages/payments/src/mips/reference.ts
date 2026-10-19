import { z } from "zod";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const length = 20;
// The largest multiple of the alphabet's size below 256. Bytes at or above it are redrawn, so
// every character is equally likely.
const unbiasedLimit = 256 - (256 % alphabet.length);

/** A reference as `createReference` makes it, and as the transaction's `mips.reference` holds it. */
export const referenceSchema = z.string().regex(/^[A-Za-z0-9]{20}$/);

/**
 * Makes the `id_order` for a new mIPS payment: 20 random alphanumeric characters. mIPS accepts 5 to
 * 25, and a transaction's database ID is too short and too easy to guess.
 */
export const createReference = () => {
  let reference = "";
  while (reference.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < unbiasedLimit && reference.length < length) {
        reference += alphabet[byte % alphabet.length];
      }
    }
  }
  return reference;
};
