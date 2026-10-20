import { type BlockComponents, CMSLink, resolveLink } from "@adirishi/offload-tanstack";

import type { Page } from "@/payload-types";

import { FormBuilderForm } from "@/components/form-builder/form";
import { NewsletterSignup } from "@/components/form-builder/newsletter-signup";
import { documentPath } from "@/seo";

/** The components that render a page's layout blocks, in a server component. */
export const pageBlocks: BlockComponents<NonNullable<Page["layout"]>[number]> = {
  quote: ({ text }) => <blockquote>{text}</blockquote>,
  cta: ({ link }) => {
    const resolved = resolveLink(link, ({ relationTo, value }) =>
      documentPath(relationTo, value.slug),
    );
    return resolved ? (
      <CMSLink href={resolved.href} newTab={resolved.newTab}>
        {resolved.label}
      </CMSLink>
    ) : null;
  },
  content: () => null,
  pullQuote: ({ quote, attribution }) => (
    <figure>
      <p>{quote}</p>
      <figcaption>{attribution}</figcaption>
    </figure>
  ),
  form: ({ form }) =>
    // A deleted form leaves the relationship null.
    typeof form === "object" && form !== null ? (
      <section>
        <FormBuilderForm form={form} />
      </section>
    ) : null,
  newsletter: ({ signupForm }) =>
    typeof signupForm === "object" && signupForm !== null ? (
      <section>
        <NewsletterSignup form={signupForm} />
      </section>
    ) : null,
};
