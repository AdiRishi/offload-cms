import { hideServerErrors, LivePreviewListener } from "@adirishi/offload-tanstack";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { renderServerComponent } from "@tanstack/react-start/rsc";

import { FormBuilderForm } from "@/components/form-builder/form";
import { NewsletterSignup } from "@/components/form-builder/newsletter-signup";
import { getPayloadForRequest, redirectOrNotFound } from "@/lib/payload.server";
// The form components render only inside server components, so the build doesn't see their
// server function. Importing its module here lets TanStack Start register it.
// oxlint-disable-next-line import/no-unassigned-import
import "@/server/forms.functions";

type PageInput = { locale?: string; slug: string };

/**
 * A page by slug. Logged-in editors get the latest draft. A missing page follows a redirect when
 * one matches, and otherwise is not found.
 */
const getPage = createServerFn({ method: "GET" })
  .middleware([hideServerErrors])
  .validator((input: PageInput) => input)
  .handler(async ({ data }) => {
    const { payload, draft, user } = await getPayloadForRequest();
    const { docs } = await payload.find({
      collection: "pages",
      depth: 1,
      draft,
      limit: 1,
      locale: data.locale === "fr" ? "fr" : "en",
      overrideAccess: false,
      user,
      where: { slug: { equals: data.slug } },
    });
    const page = docs[0];
    if (!page) return redirectOrNotFound(`/${data.slug}`);
    const layout = await Promise.all(
      (page.layout ?? []).map(async (block) => {
        switch (block.blockType) {
          case "quote":
            return { id: block.id, kind: "quote" as const, text: block.text };
          case "cta":
            return { id: block.id, kind: "cta" as const, href: block.href, label: block.label };
          case "form":
            return {
              id: block.id,
              kind: "rendered" as const,
              Content:
                typeof block.form === "object"
                  ? await renderServerComponent(<FormBuilderForm form={block.form} />)
                  : null,
            };
          case "newsletter":
            return {
              id: block.id,
              kind: "rendered" as const,
              Content:
                typeof block.signupForm === "object"
                  ? await renderServerComponent(<NewsletterSignup form={block.signupForm} />)
                  : null,
            };
          default:
            return { id: block.id, kind: "content" as const };
        }
      }),
    );
    return {
      breadcrumbs: (page.breadcrumbs ?? []).map((crumb) => crumb.label ?? ""),
      draft,
      layout,
      title: page.title,
    };
  });

export const Route = createFileRoute("/_frontend/$slug")({
  validateSearch: (search: Record<string, unknown>): { locale?: string } =>
    typeof search.locale === "string" ? { locale: search.locale } : {},
  loaderDeps: ({ search }) => ({ locale: search.locale }),
  loader: ({ deps, params }) => getPage({ data: { locale: deps.locale, slug: params.slug } }),
  component: PageView,
});

function PageView() {
  const page = Route.useLoaderData();
  return (
    <main className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4">
      {page.draft && <LivePreviewListener />}
      <nav aria-label="Breadcrumb">{page.breadcrumbs.join(" / ")}</nav>
      <h1 className="text-3xl font-semibold">{page.title}</h1>
      {page.layout.map((block) => {
        if (block.kind === "quote") return <blockquote key={block.id}>{block.text}</blockquote>;
        if (block.kind === "cta") {
          return (
            <a href={block.href} key={block.id}>
              {block.label}
            </a>
          );
        }
        if (block.kind === "rendered") return <section key={block.id}>{block.Content}</section>;
        return null;
      })}
    </main>
  );
}
