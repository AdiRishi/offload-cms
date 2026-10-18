import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

type PageInput = { locale?: string; slug: string };

const getPage = createServerFn({ method: "GET" })
  .validator((input: PageInput) => input)
  .handler(async ({ data }) => {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import("payload"),
      import("@payload-config"),
    ]);
    const payload = await getPayload({ config });
    const { docs } = await payload.find({
      collection: "pages",
      depth: 1,
      limit: 1,
      locale: data.locale === "fr" ? "fr" : "en",
      where: { slug: { equals: data.slug } },
    });
    const page = docs[0];
    if (!page) return null;
    const layout = (page.layout ?? []).map((block) => {
      if (block.blockType === "quote")
        return { id: block.id, kind: "quote" as const, text: block.text };
      if (block.blockType === "cta") {
        return { id: block.id, kind: "cta" as const, href: block.href, label: block.label };
      }
      return { id: block.id, kind: "content" as const };
    });
    return {
      breadcrumbs: (page.breadcrumbs ?? []).map((crumb) => crumb.label ?? ""),
      layout,
      title: page.title,
    };
  });

export const Route = createFileRoute("/_frontend/$slug")({
  validateSearch: (search: Record<string, unknown>): { locale?: string } =>
    typeof search.locale === "string" ? { locale: search.locale } : {},
  loaderDeps: ({ search }) => ({ locale: search.locale }),
  loader: async ({ deps, params }) => {
    const page = await getPage({ data: { locale: deps.locale, slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  component: PageView,
});

function PageView() {
  const page = Route.useLoaderData();
  return (
    <main style={{ fontFamily: "system-ui", margin: "4rem auto", maxWidth: 640 }}>
      <nav aria-label="Breadcrumb">{page.breadcrumbs.join(" / ")}</nav>
      <h1>{page.title}</h1>
      {page.layout.map((block) => {
        if (block.kind === "quote") return <blockquote key={block.id}>{block.text}</blockquote>;
        if (block.kind === "cta") {
          return (
            <a href={block.href} key={block.id}>
              {block.label}
            </a>
          );
        }
        return null;
      })}
    </main>
  );
}
