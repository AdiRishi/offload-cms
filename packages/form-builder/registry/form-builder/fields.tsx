"use client";

import { countries } from "@adirishi/offload-form-builder";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { type ComponentProps, type ReactNode, useId } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  ...input
}: FieldProps & Pick<ComponentProps<"input">, "autoComplete" | "inputMode" | "type">) {
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
      />
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
      <NativeSelect
        id={id}
        name={field.name}
        className="w-full"
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        aria-required={required ?? undefined}
      >
        <NativeSelectOption value="">{placeholder || "Choose an option"}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldError errors={errors} />
    </Field>
  );
}

function CountryField(props: FieldProps) {
  return <SelectField {...props} placeholder="Choose a country" options={countries} />;
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

/** TanStack Form with a shadcn component for each form-builder field type. */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { CheckboxField, CountryField, SelectField, TextareaField, TextField },
  formComponents: { FormError, SubmitButton },
});
