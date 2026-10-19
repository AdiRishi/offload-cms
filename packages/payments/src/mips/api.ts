import { z } from "zod";

/** The credentials MIPS issues for a merchant account. */
export type MipsCredentials = {
  /** HTTP Basic auth, sent on every call. */
  username: string;
  password: string;
  /** The `authentify` object, sent in every body. */
  merchantID: string;
  entityID: string;
  operatorID: string;
  operatorPassword: string;
  /** Sent to `decrypt_imn_data` with each payment notification. */
  salt: string;
  cipherKey: string;
};

/** The currencies mIPS takes. */
export const mipsCurrency = z.enum(["EUR", "MUR", "ZAR", "GBP", "USD"]);

/**
 * Converts an amount in units of `10 ** decimals`, as Payload stores it, to the decimal major units
 * mIPS takes.
 */
export const toMajorUnits = (amount: number, decimals: number) => amount / 10 ** decimals;

/** An order at mIPS. `amount` is in units of `10 ** decimals`, as the transaction stores it. */
export type MipsOrderRequest = {
  amount: number;
  currency: string;
  decimals: number;
  reference: string;
};

const paymentZoneAnswer = z.object({
  answer: z.object({
    operation_status: z.string(),
    payment_zone_data: z.string().optional(),
  }),
});

const ordersAnswer = z.object({
  operation_status: z.string(),
  operation_details: z.string().optional(),
  orders: z.array(z.looseObject({ id_order: z.string(), order_status: z.string() })).optional(),
});

/** The answer to an `orders_management` call with the instruction `get_order_all_data`. */
export type OrdersAnswer = z.infer<typeof ordersAnswer>;

/** The amount of an order that `get_order_all_data` reports as `success`. */
export const paidOrder = z.object({ amount: z.number(), currency: z.string() });

const operationAnswer = z.object({
  operation_status: z.string(),
  operation_details: z.string().optional(),
});

const notification = z.object({
  id_order: z.string(),
  payment_method: z.string().nullish(),
});

/** The fields Offload reads from a payment notification that `decrypt_imn_data` accepted. */
export type MipsNotification = z.infer<typeof notification>;

// The API reference documents the decrypted fields at the top level. Community integrations read
// them from `data`, next to a `status`.
const decryptedAnswer = z.union([
  notification,
  z.object({ status: z.literal("success"), data: notification }).transform(({ data }) => data),
]);

const decryptRefusal = z.union([
  z.object({ operation_status: z.literal("fail") }),
  z.object({ status: z.literal("fail") }),
]);

const orderBody = ({ amount, currency, decimals, reference }: MipsOrderRequest) => ({
  id_order: reference,
  currency,
  amount: toMajorUnits(amount, decimals),
});

const parseJSON = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Calls the mIPS merchant API at `apiURL`, such as `https://api.mips.mu/api`. */
export const mipsAPI = ({
  apiURL,
  credentials,
}: {
  apiURL: string;
  credentials: MipsCredentials;
}) => {
  const authentify = {
    id_merchant: credentials.merchantID,
    id_entity: credentials.entityID,
    id_operator: credentials.operatorID,
    operator_password: credentials.operatorPassword,
  };

  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiURL}/${path}`, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`,
        "content-type": "application/json",
        // The API reference marks user-agent as required and gives this value.
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.78 Safari/537.36",
      },
      body: JSON.stringify({ authentify, ...body }),
      signal: AbortSignal.timeout(8_000),
    });

  const call = async (path: string, body: Record<string, unknown>) => {
    const response = await post(path, body);
    if (!response.ok) throw new Error(`mIPS answered ${path} with HTTP ${response.status}.`);
    return response.json();
  };

  return {
    /** Starts a payment and returns the HTML of the payment zone, which mounts the mIPS iframe. */
    loadPaymentZone: async ({
      redirectURL,
      ...request
    }: MipsOrderRequest & { redirectURL: string }) => {
      const { answer } = paymentZoneAnswer.parse(
        await call("load_payment_zone", {
          order: orderBody(request),
          iframe_behavior: { custom_redirection_url: redirectURL, language: "EN" },
          request_mode: "simple",
          touchpoint: "web",
        }),
      );
      if (answer.operation_status !== "success" || !answer.payment_zone_data) {
        throw new Error(`mIPS refused to load a payment zone for order ${request.reference}.`);
      }
      return answer.payment_zone_data;
    },

    /** Asks mIPS for its record of an order. */
    getOrder: async (request: MipsOrderRequest) =>
      ordersAnswer.parse(
        await call("orders_management", {
          instruction: "get_order_all_data",
          order: orderBody(request),
        }),
      ),

    /** Asks mIPS to cancel an order, so that no payment can arrive for it any more. */
    cancelOrder: async (request: MipsOrderRequest) =>
      operationAnswer.parse(
        await call("orders_management", { instruction: "cancel_order", order: orderBody(request) }),
      ),

    /**
     * Has mIPS decrypt a payment notification. Throws when mIPS can't answer, or answers in a shape
     * that is neither a notification nor a refusal, so that mIPS sends the notification again. The
     * errors never quote the answer, which can hold card details.
     */
    decryptNotification: async (
      cryptedCallback: string,
    ): Promise<{ result: "decrypted"; notification: MipsNotification } | { result: "refused" }> => {
      const response = await post("decrypt_imn_data", {
        salt: credentials.salt,
        cipher_key: credentials.cipherKey,
        received_crypted_data: cryptedCallback,
      });
      if (!response.ok) {
        throw new Error(`mIPS answered decrypt_imn_data with HTTP ${response.status}.`);
      }
      const body = parseJSON(await response.text());
      const decrypted = decryptedAnswer.safeParse(body);
      if (decrypted.success) return { result: "decrypted", notification: decrypted.data };
      if (decryptRefusal.safeParse(body).success) return { result: "refused" };
      throw new Error("mIPS answered decrypt_imn_data in an unknown shape.");
    },
  };
};

export type MipsAPI = ReturnType<typeof mipsAPI>;
