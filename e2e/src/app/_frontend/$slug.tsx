import { getBindings } from "@adirishi/offload-cloudflare";
import {
  LivePreviewListener,
  Media,
  RenderBlocks,
  seoHead,
  seoMeta,
  toImageSource,
} from "@adirishi/offload-tanstack";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { renderServerComponent } from "@tanstack/react-start/rsc";

import { pageBlocks } from "@/components/page-blocks";
import { getPayloadForRequest, redirectOrNotFound } from "@/lib/payload.server";
import { seoDefaults } from "@/seo";

type PageInput = { locale?: string; slug: string };

/**
 * A page by slug. Logged-in editors get the latest draft. A missing page follows a redirect when
 * one matches, and otherwise is not found.
 */
const getPage = createServerFn({ method: "GET" })
  .validator((input: PageInput) => input)
  .handler(async ({ data }) => {
    const { payload, draft, user } = await getPayloadForRequest();
    const locale = data.locale === "fr" ? "fr" : "en";
    const [{ docs }, settings] = await Promise.all([
      payload.find({
        collection: "pages",
        depth: 1,
        draft,
        limit: 1,
        locale,
        overrideAccess: false,
        user,
        where: { slug: { equals: data.slug } },
      }),
      payload.findGlobal({ slug: "site-settings", locale, overrideAccess: false, user }),
    ]);
    const page = docs[0];
    if (!page) return redirectOrNotFound(`/${data.slug}`);
    const env = await getBindings();
    return {
      breadcrumbs: (page.breadcrumbs ?? []).map((crumb) => crumb.label ?? ""),
      content: await renderServerComponent(
        <RenderBlocks blocks={page.layout} components={pageBlocks} />,
      ),
      draft,
      hero: toImageSource(page.hero),
      seo: seoMeta({
        doc: page,
        defaults: seoDefaults,
        path: `/${page.slug}`,
        siteName: settings.siteName,
        siteUrl: env.SITE_URL,
      }),
      title: page.title,
    };
  });

export const Route = createFileRoute("/_frontend/$slug")({
  validateSearch: (search: Record<string, unknown>): { locale?: string } =>
    typeof search.locale === "string" ? { locale: search.locale } : {},
  loaderDeps: ({ search }) => ({ locale: search.locale }),
  loader: ({ deps, params }) => getPage({ data: { locale: deps.locale, slug: params.slug } }),
  head: ({ loaderData }) => (loaderData ? seoHead(loaderData.seo) : {}),
  component: PageView,
});

function PageView() {
  const page = Route.useLoaderData();
  const hydrated = useHydrated();
  return (
    <main
      data-hydrated={hydrated || undefined}
      className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4"
    >
      {page.draft && <LivePreviewListener />}
      <nav aria-label="Breadcrumb">{page.breadcrumbs.join(" / ")}</nav>
      <h1 className="text-3xl font-semibold">{page.title}</h1>
      {page.hero && (
        <Media image={page.hero} sizes="(min-width: 42rem) 42rem, 100vw" cover={16 / 9} />
      )}
      {page.content}
    </main>
  );
}
