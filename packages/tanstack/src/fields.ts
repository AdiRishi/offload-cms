import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from "@payloadcms/plugin-seo/types";
import type {
  CollectionSlug,
  Field,
  GroupField,
  PayloadRequest,
  RowLabelComponent,
  TextFieldSingleValidation,
  UIField,
  Widget,
} from "payload";

import type { QuickAction } from "./admin/rsc.tsx";
import type { SeoDefaults, UploadValue } from "./seo.ts";

export type { QuickAction } from "./admin/rsc.tsx";

const validateURL: TextFieldSingleValidation = (value, { required }) => {
  if (!value) return required ? "Enter an address." : true;
  return /^(https?:\/\/|mailto:|tel:|\/|#)/.test(value)
    ? true
    : "Start with https://, mailto:, tel:, / for a page on this site, or # for a section.";
};

export type LinkFieldOptions = {
  /** The collections whose documents the link can point to. */
  relationTo: CollectionSlug[];
  name?: string;
  label?: string | false;
  description?: string;
  /** Styles to choose from, such as `["primary", "secondary"]`, stored in `appearance`. */
  appearances?: { label: string; value: string }[];
  /**
   * Makes every field optional. `resolveLink()` returns nothing for a link without text, so an
   * editor hides the link by leaving its text empty.
   */
  optional?: boolean;
  /** Names the generated TypeScript interface, so links share one type. */
  interfaceName?: string;
};

/**
 * A group field for a link: to a document in `relationTo`, or to an address, with its text and
 * whether it opens in a new tab. `resolveLink()` turns its data into an address.
 */
export const link = ({
  relationTo,
  name = "link",
  label = "Link",
  description,
  appearances,
  optional = false,
  interfaceName,
}: LinkFieldOptions): GroupField => {
  const required = !optional;
  const fields: Field[] = [
    {
      type: "row",
      fields: [
        {
          name: "type",
          type: "radio",
          label: "Links to",
          defaultValue: "reference",
          options: [
            { label: "A page on this site", value: "reference" },
            { label: "An address", value: "custom" },
          ],
          admin: { layout: "horizontal", width: "60%" },
        },
        {
          name: "newTab",
          type: "checkbox",
          label: "Open in a new tab",
          admin: { style: { alignSelf: "flex-end" }, width: "40%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "reference",
          type: "relationship",
          label: "Document",
          relationTo,
          required,
          admin: {
            condition: (_, siblingData) => siblingData?.type !== "custom",
            width: "50%",
          },
        },
        {
          name: "url",
          type: "text",
          label: "Address",
          required,
          validate: validateURL,
          admin: {
            condition: (_, siblingData) => siblingData?.type === "custom",
            description: "Such as https://example.com, /about, or #contact for a section.",
            width: "50%",
          },
        },
        {
          name: "label",
          type: "text",
          label: "Text",
          required,
          admin: {
            description: optional ? "Leave it empty to hide the link." : undefined,
            width: "50%",
          },
        },
      ],
    },
  ];
  if (appearances) {
    fields.push({
      name: "appearance",
      type: "select",
      label: "Style",
      defaultValue: appearances[0]?.value,
      options: appearances,
    });
  }
  return {
    name,
    type: "group",
    label,
    interfaceName,
    admin: { description, hideGutter: true },
    fields,
  };
};

/**
 * Labels each row of an array field with the value at `valuePath` in the row, such as
 * `"link.label"`, or with `"<fallback> <row number>"` while that value is empty.
 */
export const rowLabel = (valuePath: string, fallback: string): RowLabelComponent => ({
  path: "@adirishi/offload-tanstack/admin/client#RowLabel",
  clientProps: { valuePath, fallback },
});

/**
 * A line of help at the top of a block's fields, because Payload's blocks take no description.
 * Put it first in the block's `fields`. It stores nothing.
 */
export const blockDescription = (text: string): UIField => ({
  name: "blockDescription",
  type: "ui",
  admin: {
    components: {
      Field: {
        path: "@adirishi/offload-tanstack/admin/client#BlockDescription",
        clientProps: { text },
      },
    },
  },
});

/**
 * A dashboard widget with a heading, a line of text, and a button for each action. List it in
 * `admin.dashboard.widgets`, and place it with `admin.dashboard.defaultLayout`.
 */
export const quickActionsWidget = ({
  slug = "quick-actions",
  label = "Quick actions",
  title,
  description,
  actions,
}: {
  slug?: string;
  label?: string;
  title: string;
  description?: string;
  actions: QuickAction[];
}): Widget => ({
  slug,
  label,
  minWidth: "medium",
  Component: {
    path: "@adirishi/offload-tanstack/admin/rsc#QuickActions",
    serverProps: { title, description, actions },
  },
});

const uploadID = (upload: UploadValue) =>
  (typeof upload === "object" && upload !== null ? upload.id : upload) ?? "";

/**
 * The SEO plugin's generators from the defaults that `seoMeta()` falls back to, so
 * Auto-generate fills a field with what the page shows while the field is empty.
 */
export const seoGenerators = <TDoc>({
  defaults,
  siteName,
  path,
  fallbackImage,
}: {
  defaults: SeoDefaults<TDoc>;
  /** The site's name, which `defaults.title` receives. */
  siteName: (req: PayloadRequest) => Promise<string> | string;
  /** The document's path on the site, such as `/about`. */
  path: (args: { doc: TDoc; collectionSlug?: string }) => string;
  /** The upload that `seoMeta()` gets as `fallbackImage`. */
  fallbackImage?: (req: PayloadRequest) => Promise<UploadValue> | UploadValue;
}) => {
  const generateTitle: GenerateTitle<TDoc> = async ({ doc, req }) =>
    defaults.title(doc, await siteName(req));
  const generateDescription: GenerateDescription<TDoc> = ({ doc }) =>
    defaults.description?.(doc) ?? "";
  const generateImage: GenerateImage<TDoc> = async ({ doc, req }) =>
    uploadID(defaults.image?.(doc) ?? (await fallbackImage?.(req)));
  const generateURL: GenerateURL<TDoc> = ({ doc, collectionSlug, req }) =>
    new URL(path({ doc, collectionSlug }), req.origin).href;
  return { generateTitle, generateDescription, generateImage, generateURL };
};
