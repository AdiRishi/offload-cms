import { z } from "zod";

import { countries } from "./countries.ts";

type FieldOf<TBlockType extends string, TDefault> = {
  blockType: TBlockType;
  name: string;
  label?: string | null;
  required?: boolean | null;
  defaultValue?: TDefault | null;
};

/**
 * A form-builder field that takes an answer. A site's generated `Form["fields"]` fits this type
 * as long as the form builder offers only these blocks.
 */
export type InputField =
  | FieldOf<"checkbox", boolean>
  | FieldOf<"country" | "email" | "state" | "text" | "textarea", string>
  | FieldOf<"number", number>
  | (FieldOf<"select", string> & {
      options?: readonly { label: string; value: string }[] | null;
      placeholder?: string | null;
    });

/** A form-builder field: an input, or a message block between inputs. */
export type FormField = InputField | { blockType: "message" };

/** A form's answers by field name. Checkboxes answer with a boolean, every other field with a string. */
export type FormValues = Record<string, string | boolean>;

export const isInputField = <F extends { blockType: string }>(
  field: F,
): field is Exclude<F, { blockType: "message" }> => field.blockType !== "message";

const required = "This field is required.";

const text = (field: InputField, rule: z.ZodType<string, string>) => {
  const value = z.string().trim();
  return field.required
    ? value.min(1, required).pipe(rule)
    : value.pipe(
        z.union([z.literal(""), rule], {
          // Report why a filled-in value failed, not that it was also not empty.
          error: (issue) =>
            issue.code === "invalid_union" ? issue.errors[1]?.[0]?.message : undefined,
        }),
      );
};

const fieldSchema = (field: InputField): z.ZodType<string | boolean, string | boolean> => {
  switch (field.blockType) {
    case "checkbox":
      return field.required ? z.literal(true, required) : z.boolean();
    case "country":
      return text(field, z.enum(countries, "Choose a country from the list."));
    case "email":
      return text(field, z.email("Enter a valid email address.").max(254));
    case "number":
      return text(field, z.string().regex(/^-?\d+(\.\d+)?$/, "Enter a number."));
    case "select":
      return text(
        field,
        z.enum(
          (field.options ?? []).map((option) => option.value),
          "Choose one of the options.",
        ),
      );
    case "state":
      return text(field, z.string().max(100, "Keep this under 100 characters."));
    case "text":
      return text(field, z.string().max(500, "Keep this under 500 characters."));
    case "textarea":
      return text(field, z.string().max(5000, "Keep this under 5,000 characters."));
  }
};

/**
 * The schema a form's values must match, derived from the fields an editor built in the form
 * builder. The browser validates with it as the visitor types, and the server validates again
 * against the stored form.
 */
export const formSchema = (fields: readonly InputField[]) =>
  z.object(Object.fromEntries(fields.map((field) => [field.name, fieldSchema(field)])));

/** The values a form starts with: each field's default, or empty. */
export const defaultValues = (fields: readonly InputField[]): FormValues =>
  Object.fromEntries(
    fields.map((field) => {
      switch (field.blockType) {
        case "checkbox":
          return [field.name, field.defaultValue ?? false];
        case "number":
          return [field.name, field.defaultValue?.toString() ?? ""];
        default:
          return [field.name, field.defaultValue ?? ""];
      }
    }),
  );

/**
 * Turns validated values into form-builder submission rows. An optional field left empty has no
 * row, and a checkbox answers `Yes` or `No`.
 */
export const submissionData = (fields: readonly InputField[], values: FormValues) =>
  fields.flatMap((field) => {
    const value = values[field.name];
    if (typeof value === "boolean") return [{ field: field.name, value: value ? "Yes" : "No" }];
    return value ? [{ field: field.name, value }] : [];
  });

/**
 * The input of the site's submission server function: the form's ID, the visitor's answers, and
 * a Turnstile token. Extend it when the site sends more, such as the document a form is about.
 */
export const submissionInput = z.object({
  form: z.union([z.number().int().positive(), z.string().min(1).max(100)]),
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
  turnstileToken: z.string().min(1).max(2048),
});

export type SubmissionInput = z.infer<typeof submissionInput>;

/** What a submission server function returns to the form. */
export type SubmissionResult =
  | { status: "sent" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "limited" | "refused" | "unverified" | "error" };
