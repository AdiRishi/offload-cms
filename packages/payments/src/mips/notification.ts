import { z } from "zod";

const jsonBody = z.object({ crypted_callback: z.string().min(1) });

/**
 * Reads `crypted_callback` from the body of a mIPS payment notification. The API reference
 * describes a JSON body but shows a form-encoded one, so this reads either. Returns `undefined`
 * when the body holds no ciphertext.
 *
 * Form decoding reads a `+` as a space. Base64 has no spaces, so each space is a `+` that the
 * sender didn't percent-encode.
 */
export const readCryptedCallback = (body: string) => {
  if (body.trimStart().startsWith("{")) {
    try {
      return jsonBody.safeParse(JSON.parse(body)).data?.crypted_callback;
    } catch {
      return undefined;
    }
  }
  return new URLSearchParams(body).get("crypted_callback")?.replaceAll(" ", "+") || undefined;
};
