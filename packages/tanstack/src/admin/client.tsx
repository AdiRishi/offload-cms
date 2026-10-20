"use client";

import { useRowLabel } from "@payloadcms/ui";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The row label that `rowLabel()` configures. */
export const RowLabel = ({ valuePath, fallback }: { valuePath: string; fallback: string }) => {
  const { data, rowNumber = 0 } = useRowLabel<unknown>();
  const value = valuePath
    .split(".")
    .reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), data);
  return (
    <span>
      {typeof value === "string" && value.trim() ? value : `${fallback} ${rowNumber + 1}`}
    </span>
  );
};

/** The field that `blockDescription()` configures. */
export const BlockDescription = ({ text }: { text: string }) => (
  <p className="field-description" style={{ marginBlock: "0 var(--spacer-3, 1rem)" }}>
    {text}
  </p>
);
