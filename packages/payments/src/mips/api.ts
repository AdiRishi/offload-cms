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

/** The currencies mIPS takes. Each has 2 decimals. */
export const mipsCurrency = z.enum(["EUR", "MUR", "ZAR", "GBP", "USD"]);

/** Converts an amount in minor units, as Payload stores it, to the decimal major units mIPS takes. */
export const toMajorUnits = (amount: number) => amount / 100;

const operationStatus = z.enum(["success", "fail"]);

const paymentZoneAnswer = z.object({
  answer: z.object({
    operation_status: operationStatus,
    payment_zone_data: z.string().optional(),
  }),
});

const orderDetails = z.object({
  id_order: z.string(),
  amount: z.number(),
  currency: z.string(),
  order_status: z.enum(["success", "fail", "waiting", "expired"]),
});

const ordersAnswer = z.object({
  operation_status: operationStatus,
  operation_details: z.string().optional(),
  orders: z.array(orderDetails).optional(),
});

/** The answer to an `orders_management` call with the instruction `get_order_all_data`. */
export type OrdersAnswer = z.infer<typeof ordersAnswer>;

const decryptedNotification = z.object({
  id_order: z.string(),
  payment_method: z.string().optional(),
});

/** The fields Offload reads from a payment notification that `decrypt_imn_data` accepted. */
export type MipsNotification = z.infer<typeof decryptedNotification>;

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
    });

  const call = async (path: string, body: Record<string, unknown>) => {
    const response = await post(path, body);
    if (!response.ok) throw new Error(`mIPS answered ${path} with HTTP ${response.status}.`);
    return response.json();
  };

  return {
    /** Starts a payment and returns the HTML of the payment zone, which mounts the mIPS iframe. */
    loadPaymentZone: async ({
      amount,
      currency,
      redirectURL,
      reference,
    }: {
      amount: number;
      currency: string;
      redirectURL: string;
      reference: string;
    }) => {
      const { answer } = paymentZoneAnswer.parse(
        await call("load_payment_zone", {
          order: { id_order: reference, currency, amount: toMajorUnits(amount) },
          iframe_behavior: { custom_redirection_url: redirectURL, language: "EN" },
          request_mode: "simple",
          touchpoint: "web",
        }),
      );
      if (answer.operation_status !== "success" || !answer.payment_zone_data) {
        throw new Error(`mIPS refused to load a payment zone for order ${reference}.`);
      }
      return answer.payment_zone_data;
    },

    /** Asks mIPS for its record of an order. */
    getOrder: async ({
      amount,
      currency,
      reference,
    }: {
      amount: number;
      currency: string;
      reference: string;
    }) =>
      ordersAnswer.parse(
        await call("orders_management", {
          instruction: "get_order_all_data",
          order: { id_order: reference, currency, amount: toMajorUnits(amount) },
        }),
      ),

    /**
     * Has mIPS decrypt a payment notification. Returns `undefined` when mIPS refuses the ciphertext,
     * and throws when mIPS can't answer.
     */
    decryptNotification: async (cryptedCallback: string) => {
      const response = await post("decrypt_imn_data", {
        salt: credentials.salt,
        cipher_key: credentials.cipherKey,
        received_crypted_data: cryptedCallback,
      });
      if (response.status >= 500) {
        throw new Error(`mIPS answered decrypt_imn_data with HTTP ${response.status}.`);
      }
      if (!response.ok) return undefined;
      return decryptedNotification.safeParse(parseJSON(await response.text())).data;
    },
  };
};

export type MipsAPI = ReturnType<typeof mipsAPI>;
