"use client";

import { useFormFields } from "@payloadcms/ui";

/** A slug field's description, with the address that the slug gives the document. */
export const SlugAddress = () => {
  const slug = useFormFields(([fields]) => fields.slug?.value);
  return (
    <div className="field-description" data-testid="slug-address">
      Address: /field-types/{typeof slug === "string" ? slug : ""}
    </div>
  );
};
