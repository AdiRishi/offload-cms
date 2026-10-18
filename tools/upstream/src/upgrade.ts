// Moves the Offload patches onto a newer upstream release.
//
// usage:
//   pnpm upstream:upgrade <tag> [--drop <patch-id> ...]
//   pnpm upstream:upgrade --continue
//
// Patches are cherry-picked one at a time onto the new tag. On a conflict the
// script stops and prints the patch's intent. Resolve the conflict in
// vendor/payload, run `git -C vendor/payload cherry-pick --continue`, then
// `pnpm upstream:upgrade --continue` to apply the rest. A patch that becomes
// empty is already upstream and is dropped. The old branch stays at
// refs/offload/previous.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { fail, readPin, run, vendorChanges, vendorDir, vendorGit, vendorGitOutput, writePin } from '../lib.ts'
import { type PatchCommit, readPatchCommits } from './patches.ts'

type QueuedPatch = Pick<PatchCommit, 'id' | 'intent' | 'sha' | 'subject'>
type PendingUpgrade = { commit: string; queue: QueuedPatch[]; tag: string }

const statePath = path.join(vendorDir, '.git', 'offload-upgrade.json')
const saveState = (state: PendingUpgrade) => writeFileSync(statePath, JSON.stringify(state, null, 2))

const isQueuedPatch = (value: unknown): value is QueuedPatch =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'intent' in value &&
  typeof value.intent === 'string' &&
  'sha' in value &&
  typeof value.sha === 'string' &&
  'subject' in value &&
  typeof value.subject === 'string'

const readState = (): PendingUpgrade => {
  if (!existsSync(statePath)) return fail('No upgrade in progress.')
  const state: unknown = JSON.parse(readFileSync(statePath, 'utf8'))
  if (
    typeof state === 'object' &&
    state !== null &&
    'commit' in state &&
    typeof state.commit === 'string' &&
    'tag' in state &&
    typeof state.tag === 'string' &&
    'queue' in state &&
    Array.isArray(state.queue) &&
    state.queue.every(isQueuedPatch)
  ) {
    return { commit: state.commit, queue: state.queue, tag: state.tag }
  }
  return fail(`${statePath} is not a valid upgrade state.`)
}

const applyQueue = (state: PendingUpgrade) => {
  if (existsSync(path.join(vendorDir, '.git', 'CHERRY_PICK_HEAD'))) {
    fail('A cherry-pick is still in progress. Resolve it and run `git -C vendor/payload cherry-pick --continue` first.')
  }

  for (const [index, patch] of state.queue.entries()) {
    saveState({ ...state, queue: state.queue.slice(index + 1) })
    console.log(`\nApplying ${patch.id}: ${patch.subject}`)
    try {
      vendorGit(['cherry-pick', '--allow-empty', '--keep-redundant-commits', patch.sha])
    } catch {
      fail(
        [
          `Patch ${patch.id} conflicts with ${state.tag}. Its intent:`,
          '',
          patch.intent,
          '',
          'Resolve the conflict in vendor/payload, then run:',
          '  git -C vendor/payload add <files> && git -C vendor/payload cherry-pick --continue',
          '  pnpm upstream:upgrade --continue',
        ].join('\n'),
      )
    }
    if (vendorGitOutput(['diff', '--stat', 'HEAD~1', 'HEAD']) === '') {
      console.log(`${patch.id} is empty on ${state.tag}, so upstream already has it. Dropping it.`)
      vendorGit(['reset', '--hard', 'HEAD~1'])
    }
  }

  vendorGit(['tag', '--force', 'offload-base', state.commit])
  writePin({ ...readPin(), commit: state.commit, revision: 0, tag: state.tag })
  rmSync(statePath, { force: true })
  run('node', [path.join(import.meta.dirname, 'export.ts')])
  console.log(`\nUpgraded to ${state.tag}. Review upstream/patches, then build, test and release.`)
}

const start = (tag: string) => {
  const pin = readPin()
  if (vendorChanges() !== '') {
    fail('vendor/payload has uncommitted changes. Export or discard them first.')
  }

  const dropped = process.argv.flatMap((arg, index) => (process.argv[index - 1] === '--drop' ? [arg] : []))
  const commits = readPatchCommits({ base: pin.commit, head: 'offload' })
  const unknownDrops = dropped.filter((id) => !commits.some((commit) => commit.id === id))
  if (unknownDrops.length > 0) fail(`Unknown patch id(s): ${unknownDrops.join(', ')}`)

  vendorGit(['fetch', '--tags', 'origin'])
  const commit = vendorGitOutput(['rev-parse', `${tag}^{commit}`])

  vendorGit(['update-ref', 'refs/offload/previous', 'offload'])
  vendorGit(['checkout', '--force', '-B', 'offload', commit])

  applyQueue({
    commit,
    queue: commits
      .filter((patch) => !dropped.includes(patch.id))
      .map(({ id, intent, sha, subject }) => ({ id, intent, sha, subject })),
    tag,
  })
}

const tag = process.argv[2]
if (tag === '--continue') applyQueue(readState())
else if (tag === undefined || tag.startsWith('--')) fail('usage: pnpm upstream:upgrade <tag> [--drop <patch-id> ...]')
else start(tag)
