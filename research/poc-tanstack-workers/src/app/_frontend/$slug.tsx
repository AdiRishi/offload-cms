import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getPage = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      depth: 1,
      limit: 1,
    })
    const page = docs[0]
    if (!page) return null
    const blocks = (page.blocks ?? []).map((block) =>
      block.blockType === 'quote'
        ? { type: 'quote' as const, text: block.text ?? '', author: block.author ?? '' }
        : { type: 'cta' as const, label: block.label ?? '', href: block.href ?? '' },
    )
    return { title: page.title, blocks, bodyJSON: JSON.stringify(page.body ?? null) }
  })

export const Route = createFileRoute('/_frontend/$slug')({
  loader: async ({ params }) => {
    const page = await getPage({ data: params.slug })
    if (!page) throw notFound()
    return page
  },
  component: PageView,
})

function PageView() {
  const page = Route.useLoaderData()
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '4rem auto' }}>
      <h1 data-testid="title">{page.title}</h1>
      {page.blocks.map((block, i) =>
        block.type === 'quote' ? (
          <blockquote key={i}>{block.text}</blockquote>
        ) : (
          <a key={i} href={block.href}>
            {block.label}
          </a>
        ),
      )}
      <details>
        <summary>Lexical JSON</summary>
        <pre>{page.bodyJSON}</pre>
      </details>
    </main>
  )
}
