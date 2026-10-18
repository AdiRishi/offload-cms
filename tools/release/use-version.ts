// Points a site at an Offload release: sets every `@arishi/offload-*`
// dependency in its package.json, including npm aliases, to one version.
//
// usage: pnpm use-version <site-dir> [version]   (default: the pinned release)

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { fail, offloadVersion, readPin } from '../lib.ts'

const offloadAlias = /^npm:(@arishi\/offload-[a-z0-9-]+)@/

const [siteDir, requested] = process.argv.slice(2)
if (siteDir === undefined) fail('usage: pnpm use-version <site-dir> [version]')
else {
  const version = requested ?? offloadVersion(readPin())
  const manifestPath = path.resolve(siteDir, 'package.json')
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (typeof manifest !== 'object' || manifest === null) fail(`${manifestPath} is not a JSON object`)
  else {
    let changed = 0
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const dependencies = field in manifest ? Reflect.get(manifest, field) : undefined
      if (typeof dependencies !== 'object' || dependencies === null) continue
      for (const [name, range] of Object.entries(dependencies)) {
        if (typeof range !== 'string') continue
        const alias = offloadAlias.exec(range)?.[1]
        const next = alias
          ? `npm:${alias}@${version}`
          : name.startsWith('@arishi/offload-')
            ? version
            : range
        if (next !== range) {
          Reflect.set(dependencies, name, next)
          changed++
        }
      }
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`Set ${changed} Offload dependencies in ${manifestPath} to ${version}.`)
  }
}
