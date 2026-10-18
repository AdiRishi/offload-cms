// Prototype of the Offload release transform.
//
// Takes the tarballs Payload's own `pnpm pack` produces, renames each package to
// the @offload scope, gives every package the same Offload version, and rewrites
// internal dependencies to npm aliases. Consumers install `payload` and
// `@payloadcms/*` as aliases of the @offload packages, so every import specifier,
// import-map string and peer check in upstream code keeps working unchanged.
//
// usage: node republish.mjs <tarball-dir> <offload-version> <registry-url>

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const [tarballDir, version, registry] = process.argv.slice(2)
if (!tarballDir || !version || !registry) {
  throw new Error('usage: node republish.mjs <tarball-dir> <offload-version> <registry-url>')
}

const offloadName = (upstreamName) =>
  upstreamName === 'payload'
    ? '@offload/payload'
    : upstreamName === 'create-payload-app'
      ? '@offload/create-payload-app'
      : upstreamName.replace(/^@payloadcms\//, '@offload/')

const tarballs = readdirSync(tarballDir).filter((file) => file.endsWith('.tgz'))
const extracted = tarballs.map((file) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'offload-pkg-'))
  execFileSync('tar', ['-xzf', path.join(tarballDir, file), '-C', dir])
  const manifestPath = path.join(dir, 'package', 'package.json')
  return { dir, manifestPath, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) }
})

const upstreamNames = new Set(extracted.map(({ manifest }) => manifest.name))

for (const { dir, manifestPath, manifest } of extracted) {
  const upstream = `${manifest.name}@${manifest.version}`
  const upstreamName = manifest.name
  manifest.name = offloadName(upstreamName)
  manifest.version = version
  manifest.offload = { upstream }
  delete manifest.publishConfig

  for (const field of ['dependencies', 'optionalDependencies', 'devDependencies']) {
    for (const dep of Object.keys(manifest[field] ?? {})) {
      if (upstreamNames.has(dep)) manifest[field][dep] = `npm:${offloadName(dep)}@${version}`
    }
  }
  // Peers keep the alias name the consumer installs, so only the version moves.
  for (const dep of Object.keys(manifest.peerDependencies ?? {})) {
    if (upstreamNames.has(dep)) manifest.peerDependencies[dep] = version
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  execFileSync(
    'npm',
    ['publish', path.join(dir, 'package'), '--registry', registry, '--tag', 'latest', '--access', 'public'],
    { stdio: 'inherit' },
  )
  console.log(`published ${manifest.name}@${version} (from ${upstreamName})`)
}
