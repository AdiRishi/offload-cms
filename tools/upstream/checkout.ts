// Creates vendor/payload: upstream Payload at the pinned commit with
// upstream/patches applied on the `offload` branch.
//
// usage: pnpm upstream:checkout [--force]

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

import {
  fail,
  patchesDir,
  readPin,
  run,
  vendorDir,
  vendorGit,
  vendorChanges,
  vendorGitOutput,
} from '../lib.ts'

const force = process.argv.includes('--force')
const pin = readPin()

if (!existsSync(path.join(vendorDir, '.git'))) {
  mkdirSync(path.dirname(vendorDir), { recursive: true })
  run('git', ['clone', '--filter=blob:none', '--no-checkout', pin.repository, vendorDir])
} else if (vendorChanges() !== '' && !force) {
  fail('vendor/payload has uncommitted changes. Commit and `pnpm upstream:export` them, or rerun with --force.')
}

const hasCommit = () => {
  try {
    vendorGitOutput(['cat-file', '-e', `${pin.commit}^{commit}`])
    return true
  } catch {
    return false
  }
}
if (!hasCommit()) vendorGit(['fetch', '--tags', 'origin'])

vendorGit(['config', 'rerere.enabled', 'true'])
vendorGit(['config', 'rerere.autoupdate', 'true'])
vendorGit(['config', 'user.name', 'Offload'])
vendorGit(['config', 'user.email', 'offload@localhost'])
// Patch files carry no signatures, so signing the throwaway commits here adds nothing.
vendorGit(['config', 'commit.gpgsign', 'false'])
vendorGit(['checkout', '--force', '-B', 'offload', pin.commit])
vendorGit(['clean', '-fdq', '--exclude=node_modules'])
vendorGit(['tag', '--force', 'offload-base', pin.commit])

const patches = readdirSync(patchesDir)
  .filter((file) => file.endsWith('.patch'))
  .sort()
  .map((file) => path.join(patchesDir, file))

if (patches.length > 0) {
  try {
    vendorGit(['am', '-3', '--committer-date-is-author-date', ...patches])
  } catch {
    fail(
      [
        'A patch did not apply. Resolve the conflict in vendor/payload, then:',
        '  git -C vendor/payload add <files> && git -C vendor/payload am --continue',
        '  pnpm upstream:export',
      ].join('\n'),
    )
  }
}

console.log(`\nvendor/payload is ${pin.tag} with ${patches.length} Offload patch(es) on branch offload.`)
