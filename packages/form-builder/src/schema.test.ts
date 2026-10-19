import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";

import {
  defaultValues,
  type FormField,
  formSchema,
  type FormValues,
  isInputField,
  submissionData,
} from "./schema.ts";

const registration: FormField[] = [
  { blockType: "text", name: "fullName", label: "Full name", required: true },
  { blockType: "email", name: "email", label: "Email", required: true },
  { blockType: "text", name: "phone", label: "Phone" },
  { blockType: "number", name: "guests", label: "Guests", defaultValue: 1 },
  {
    blockType: "select",
    name: "heardFrom",
    label: "How did you hear about us?",
    defaultValue: "friend",
    options: [
      { label: "A friend", value: "friend" },
      { label: "Social media", value: "social" },
    ],
  },
  { blockType: "country", name: "country", label: "Country", required: true },
  { blockType: "state", name: "region", label: "Region" },
  { blockType: "message" },
  { blockType: "textarea", name: "notes", label: "Anything we should know?" },
  { blockType: "checkbox", name: "consent", label: "I agree to be contacted", required: true },
];
const fields = registration.filter(isInputField);
const schema = formSchema(fields);

const complete = {
  fullName: "  Asha Ramdin ",
  email: "asha@example.mu",
  phone: "",
  guests: "2",
  heardFrom: "social",
  country: "Mauritius",
  region: "",
  notes: "",
  consent: true,
};

const errorsOf = (values: FormValues) => {
  const result = schema.safeParse(values);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
};

test("turns a valid submission into submission rows, leaving out empty optional fields", () => {
  const result = schema.parse(complete);

  assert.deepEqual(submissionData(fields, result), [
    { field: "fullName", value: "Asha Ramdin" },
    { field: "email", value: "asha@example.mu" },
    { field: "guests", value: "2" },
    { field: "heardFrom", value: "social" },
    { field: "country", value: "Mauritius" },
    { field: "consent", value: "Yes" },
  ]);
});

test("reports every required field that is missing", () => {
  const errors = errorsOf({ ...complete, fullName: " ", email: "", country: "", consent: false });

  assert.deepEqual(Object.keys(errors).toSorted(), ["consent", "country", "email", "fullName"]);
  assert.deepEqual(errors.email, ["This field is required."]);
});

test("rejects values the form does not offer", () => {
  const errors = errorsOf({
    ...complete,
    email: "asha@",
    guests: "two",
    heardFrom: "billboard",
    country: "Atlantis",
  });

  assert.deepEqual(errors, {
    email: ["Enter a valid email address."],
    guests: ["Enter a number."],
    heardFrom: ["Choose one of the options."],
    country: ["Choose a country from the list."],
  });
});

test("records an unticked optional checkbox as No", () => {
  const updates: FormField[] = [{ blockType: "checkbox", name: "updates", label: "Send me news" }];
  const inputs = updates.filter(isInputField);

  assert.deepEqual(submissionData(inputs, formSchema(inputs).parse({ updates: false })), [
    { field: "updates", value: "No" },
  ]);
});

test("starts from the defaults an editor set", () => {
  assert.deepEqual(defaultValues(fields), {
    fullName: "",
    email: "",
    phone: "",
    guests: "1",
    heardFrom: "friend",
    country: "",
    region: "",
    notes: "",
    consent: false,
  });
});

test("leaves out blocks the package doesn't support, so the rest of the form still works", () => {
  const stored: { blockType: string; name?: string }[] = [
    { blockType: "radio", name: "size" },
    { blockType: "email", name: "email" },
  ];
  const inputs = stored.filter(isInputField);

  assert.deepEqual(inputs, [{ blockType: "email", name: "email" }]);
  assert.equal(formSchema(inputs).safeParse({ email: "ada@example.com" }).success, true);
});
