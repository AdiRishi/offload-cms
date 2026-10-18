// Builds the patched Payload in vendor/payload and publishes every package as
// @arishi/offload-<name>, followed by Offload's own packages in packages/.
//
// Internal dependencies become npm aliases ("@payloadcms/ui":
// "npm:@arishi/offload-ui@<version>"), so code keeps importing `payload` and
// `@payloadcms/*` and sites install the Offload builds under those names.
//
// usage: pnpm release [--skip-build] [--registry <url>]
//   OFFLOAD_REGISTRY        registry URL (default http://localhost:4873)
//   OFFLOAD_REGISTRY_TOKEN  auth token (not needed for the local registry)

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  fail,
  offloadPackageName,
  offloadVersion,
  output,
  readPin,
  repoRoot,
  run,
  vendorDir,
  vendorChanges,
  vendorGitOutput,
} from '../lib.ts'

const registryArg = process.argv.indexOf('--registry')
const registry =
  (registryArg === -1 ? undefined : process.argv[registryArg + 1]) ??
  process.env.OFFLOAD_REGISTRY ??
  'http://localhost:4873'
const skipBuild = process.argv.includes('--skip-build')

const pin = readPin()
const version = offloadVersion(pin)

const patchFiles = readdirSync(path.join(repoRoot, 'upstream', 'patches')).filter((file) =>
  file.endsWith('.patch'),
)
const appliedPatches = vendorGitOutput(['rev-list', '--count', `${pin.commit}..offload`])
if (
  vendorGitOutput(['rev-parse', 'offload-base']) !== pin.commit ||
  Number(appliedPatches) !== patchFiles.length ||
  vendorChanges() !== ''
) {
  fail('vendor/payload does not match upstream/. Run `pnpm upstream:checkout --force` first.')
}

if (!skipBuild) {
  run('pnpm', ['install', '--frozen-lockfile'], { cwd: vendorDir })
  run('pnpm', ['build:all'], { cwd: vendorDir })
  run('pnpm', ['--filter', './packages/*', 'build'], { cwd: repoRoot })
}

// Payload's own release order: dependencies before dependents.
const publishList = [
  ...readFileSync(path.join(vendorDir, 'tools/releaser/src/lib/publishList.ts'), 'utf8').matchAll(
    /^\s*'([a-z0-9-]+)',?$/gm,
  ),
].map(([, directory = '']) => path.join(vendorDir, 'packages', directory))
if (publishList.length === 0) fail('Could not read the publish list from vendor/payload.')

const ownPackages = readdirSync(path.join(repoRoot, 'packages'))
  .map((directory) => path.join(repoRoot, 'packages', directory))
  .filter((directory) => {
    const manifest: unknown = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
    return typeof manifest === 'object' && manifest !== null && !('private' in manifest && manifest.private === true)
  })

const packDir = mkdtempSync(path.join(tmpdir(), 'offload-release-'))

type Packed = { directory: string; manifest: Record<string, unknown>; manifestPath: string }

const pack = (packageDir: string): Packed => {
  const tarball = output('pnpm', ['pack', '--pack-destination', packDir], { cwd: packageDir })
    .split('\n')
    .findLast((line) => line.endsWith('.tgz'))
  if (tarball === undefined) return fail(`pnpm pack produced no tarball for ${packageDir}`)

  const directory = mkdtempSync(path.join(packDir, 'pkg-'))
  run('tar', ['-xzf', path.resolve(packDir, tarball), '-C', directory])
  const manifestPath = path.join(directory, 'package', 'package.json')
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    return fail(`${manifestPath} is not a JSON object`)
  }
  return { directory: path.join(directory, 'package'), manifest: { ...manifest }, manifestPath }
}

const upstreamPackages = publishList.map(pack)
const upstreamNames = new Set(upstreamPackages.map(({ manifest }) => String(manifest.name)))

const isDependencyMap = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((range) => typeof range === 'string')

const rewrite = ({ manifest, manifestPath }: Packed) => {
  const name = String(manifest.name)
  const rewritten: Record<string, unknown> = {
    ...manifest,
    name: upstreamNames.has(name) ? offloadPackageName(name) : name,
    version,
    offload: upstreamNames.has(name) ? { upstream: `${name}@${String(manifest.version)}` } : undefined,
    publishConfig: undefined,
  }

  for (const field of ['dependencies', 'optionalDependencies', 'devDependencies']) {
    const dependencies = manifest[field]
    if (!isDependencyMap(dependencies)) continue
    rewritten[field] = Object.fromEntries(
      Object.entries(dependencies).map(([dependency, range]) => [
        dependency,
        upstreamNames.has(dependency) ? `npm:${offloadPackageName(dependency)}@${version}` : range,
      ]),
    )
  }
  // Peers keep the names the site installs, so only the version changes.
  const peers = manifest.peerDependencies
  if (isDependencyMap(peers)) {
    rewritten.peerDependencies = Object.fromEntries(
      Object.entries(peers).map(([dependency, range]) => [
        dependency,
        upstreamNames.has(dependency) ? version : range,
      ]),
    )
  }

  writeFileSync(manifestPath, `${JSON.stringify(rewritten, null, 2)}\n`)
  return String(rewritten.name)
}

const npmrc = path.join(packDir, '.npmrc')
const registryHost = registry.replace(/^https?:/, '')
writeFileSync(
  npmrc,
  `${registryHost.endsWith('/') ? registryHost : `${registryHost}/`}:_authToken=${process.env.OFFLOAD_REGISTRY_TOKEN ?? 'local-registry'}\n`,
)

const published = [...upstreamPackages, ...ownPackages.map(pack)].map((packed) => {
  const name = rewrite(packed)
  run('npm', ['publish', packed.directory, '--registry', registry, '--tag', 'latest', '--userconfig', npmrc])
  return name
})

rmSync(packDir, { force: true, recursive: true })
console.log(`\nPublished ${published.length} packages at ${version} to ${registry}:`)
console.log(published.map((name) => `  ${name}`).join('\n'))
