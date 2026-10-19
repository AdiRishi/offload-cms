import { z } from "zod";

const jsonBody = z.object({ crypted_callback: z.string().min(1) });

/**
 * Reads `crypted_callback` from the body of a mIPS payment notification. The API reference
 * describes a JSON body but shows a form-encoded one, so this reads either. Returns `undefined`
 * when the body holds no ciphertext.
 */
export const readCryptedCallback = (body: string) => {
  if (body.trimStart().startsWith("{")) {
    try {
      return jsonBody.safeParse(JSON.parse(body)).data?.crypted_callback;
    } catch {
      return undefined;
    }
  }
  return new URLSearchParams(body).get("crypted_callback") || undefined;
};
