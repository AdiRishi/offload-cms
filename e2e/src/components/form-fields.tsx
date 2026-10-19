"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { type ComponentProps, type ReactNode, useId } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

type FieldProps = { label: string; required?: boolean | null };

function useControl<T>() {
  const field = useFieldContext<T>();
  const id = useId();
  const invalid = !field.state.meta.isValid;
  return { field, id, invalid, errors: field.state.meta.errors };
}

function Label({ htmlFor, label, required }: FieldProps & { htmlFor: string }) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      <span>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1.5 text-muted-foreground">
            *
          </span>
        ) : null}
      </span>
    </FieldLabel>
  );
}

function TextField({
  label,
  required,
  description,
  ...input
}: FieldProps & { description?: string } & Pick<
    ComponentProps<"input">,
    "autoComplete" | "inputMode" | "type"
  >) {
  const { field, id, invalid, errors } = useControl<string>();
  return (
    <Field data-invalid={invalid}>
      <Label htmlFor={id} label={label} required={required} />
      <Input
        {...input}
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        aria-required={required ?? undefined}
        aria-describedby={description ? `${id}-description` : undefined}
      />
      {description ? (
        <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
      ) : null}
      <FieldError errors={errors} />
    </Field>
  );
}

function TextareaField({ label, required }: FieldProps) {
  const { field, id, invalid, errors } = useControl<string>();
  return (
    <Field data-invalid={invalid}>
      <Label htmlFor={id} label={label} required={required} />
      <Textarea
        id={id}
        name={field.name}
        rows={5}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        aria-required={required ?? undefined}
      />
      <FieldError errors={errors} />
    </Field>
  );
}

// A native select styled like shadcn's input, so the item needs no select component.
const selectClassName =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&>option]:bg-[Canvas] [&>option]:text-[CanvasText]";

function SelectField({
  label,
  required,
  placeholder,
  options,
}: FieldProps & {
  placeholder?: string | null;
  options: readonly { label: string; value: string }[];
}) {
  const { field, id, invalid, errors } = useControl<string>();
  return (
    <Field data-invalid={invalid}>
      <Label htmlFor={id} label={label} required={required} />
      <select
        id={id}
        name={field.name}
        className={selectClassName}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        aria-required={required ?? undefined}
      >
        <option value="">{placeholder || "Choose an option"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError errors={errors} />
    </Field>
  );
}

function CheckboxField({ label, required }: FieldProps) {
  const { field, id, invalid, errors } = useControl<boolean>();
  return (
    <Field orientation="horizontal" data-invalid={invalid}>
      <Checkbox
        id={id}
        name={field.name}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
        onBlur={field.handleBlur}
        aria-invalid={invalid}
        aria-required={required ?? undefined}
      />
      <FieldContent>
        <Label htmlFor={id} label={label} required={required} />
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting} aria-disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : null}
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

function FormError() {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) =>
        typeof error === "string" ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null
      }
    </form.Subscribe>
  );
}

/**
 * TanStack Form with shadcn components for text, textarea, select, and checkbox fields, a submit
 * button, and the message that a failed submit returns.
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { CheckboxField, SelectField, TextareaField, TextField },
  formComponents: { FormError, SubmitButton },
});
