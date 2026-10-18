// Smoke test for an Offload site running in workerd: `vite preview` locally,
// or a deployed Worker with SMOKE_BASE_URL. Creates a page and an upload,
// checks them through REST, GraphQL and the frontend, then deletes them.
//
// usage: pnpm test:smoke
//   SMOKE_BASE_URL   default http://localhost:4173
//   SMOKE_EMAIL      default smoke@offload.test
//   SMOKE_PASSWORD   default offload-smoke-password
//
// On a fresh database the first run registers the smoke user as the first admin.

import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { deflateSync } from 'node:zlib'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:4173'
const email = process.env.SMOKE_EMAIL ?? 'smoke@offload.test'
const password = process.env.SMOKE_PASSWORD ?? 'offload-smoke-password'
const isLocal = new URL(baseURL).hostname === 'localhost'
const slug = `smoke-${Date.now()}`

let token = ''
const created: Array<{ collection: string; id: number | string }> = []

type ApiInit = { body?: FormData | string; headers?: Record<string, string>; method?: string }

const api = (path: string, { body, headers, method }: ApiInit = {}) =>
  fetch(new URL(path, baseURL), {
    body,
    headers: { ...(token ? { Authorization: `JWT ${token}` } : {}), ...headers },
    method,
    redirect: 'manual',
  })

const json = async (response: Response): Promise<Record<string, unknown>> => {
  const body: unknown = await response.json()
  assert.ok(typeof body === 'object' && body !== null && !Array.isArray(body), 'expected a JSON object')
  return { ...body }
}

const docID = (body: Record<string, unknown>) => {
  const doc = body.doc
  assert.ok(typeof doc === 'object' && doc !== null && 'id' in doc)
  assert.ok(typeof doc.id === 'number' || typeof doc.id === 'string')
  return doc.id
}

/** A gradient PNG, built here so the test has no fixture files. */
const png = ({ height, width }: { height: number; width: number }): Uint8Array => {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff
    for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc(body))
    return Buffer.concat([length, body, checksum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const pixels = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.set([(x * 255) / width, (y * 255) / height, 128], y * (1 + width * 3) + 1 + x * 3)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

before(async () => {
  const credentials = JSON.stringify({ email, password })
  const headers = { 'Content-Type': 'application/json' }

  let response = await api('/api/users/login', { body: credentials, headers, method: 'POST' })
  if (response.status === 401) {
    response = await api('/api/users/first-register', { body: credentials, headers, method: 'POST' })
  }
  assert.equal(response.status, 200, 'log in, or register the first user')
  const body = await json(response)
  assert.ok(typeof body.token === 'string')
  token = body.token
})

after(async () => {
  for (const { collection, id } of created.reverse()) {
    await api(`/api/${collection}/${id}`, { method: 'DELETE' })
  }
})

test('frontend and admin respond', async () => {
  assert.equal((await api('/')).status, 200)
  assert.equal((await api('/admin')).status, 200)
})

test('access control rejects anonymous reads of users', async () => {
  const anonymous = await fetch(new URL('/api/users', baseURL))
  assert.equal(anonymous.status, 403)
})

test('uploads are stored in R2 and served back unchanged', async () => {
  const image = png({ height: 480, width: 640 })
  const form = new FormData()
  form.append('file', new Blob([image], { type: 'image/png' }), `${slug}.png`)
  form.append('_payload', JSON.stringify({ alt: 'Smoke test' }))

  const response = await api('/api/media', { body: form, method: 'POST' })
  assert.equal(response.status, 201)
  const id = docID(await json(response))
  created.push({ collection: 'media', id })

  const media = await json(await api(`/api/media/${id}?depth=0`))
  assert.equal(media.width, 640)
  assert.equal(media.height, 480)
  assert.ok(typeof media.url === 'string')

  const file = await api(media.url)
  assert.equal(file.status, 200)
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array(image))
})

test('a published page renders on the frontend and through GraphQL', async () => {
  const response = await api('/api/pages', {
    body: JSON.stringify({
      _status: 'published',
      blocks: [{ blockType: 'quote', text: 'Served from a Worker' }],
      slug,
      title: `Smoke ${slug}`,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  assert.equal(response.status, 201)
  created.push({ collection: 'pages', id: docID(await json(response)) })

  const html = await (await api(`/${slug}`)).text()
  assert.match(html, new RegExp(`Smoke ${slug}`))
  assert.match(html, /Served from a Worker/)

  const graphql = await json(
    await api('/api/graphql', {
      body: JSON.stringify({
        query: 'query ($slug: String) { Pages(where: { slug: { equals: $slug } }, limit: 1) { docs { title } } }',
        variables: { slug },
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  )
  assert.deepEqual(graphql, { data: { Pages: { docs: [{ title: `Smoke ${slug}` }] } } })
})

test('the Cron Trigger runs Payload jobs', { skip: !isLocal && 'Cron Triggers can only be fired locally' }, async () => {
  const response = await fetch(
    new URL('/cdn-cgi/local/explorer/api/local/scheduled?worker=offload-site', baseURL),
    {
      body: JSON.stringify({ cron: '*/5 * * * *' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const body = await json(response)
  assert.deepEqual(body.result, { noRetry: false, outcome: 'ok' })
})
