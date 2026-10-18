// Lists the Offload patches and the state of each upstream PR. With
// `--against <tag>`, also reports whether that release already contains the
// merged PR, which means the patch can be dropped on upgrade.
//
// usage: pnpm upstream:status [--against v4.0.0-beta.3]

import { output, readPin } from '../lib.ts'
import { readPatchCommits } from './patches.ts'

const againstIndex = process.argv.indexOf('--against')
const against = againstIndex === -1 ? undefined : process.argv[againstIndex + 1]
const pin = readPin()

const pullRequest = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/

const upstreamState = (upstream: string | undefined): string => {
  const match = upstream === undefined ? null : pullRequest.exec(upstream)
  if (!match) return upstream === undefined ? 'not proposed' : 'not a PR'
  const [, repository = '', number = ''] = match

  const pr: unknown = JSON.parse(
    output('gh', ['pr', 'view', number, '--repo', repository, '--json', 'state,mergeCommit']),
  )
  if (typeof pr !== 'object' || pr === null || !('state' in pr) || typeof pr.state !== 'string') {
    return 'unknown'
  }
  if (pr.state !== 'MERGED' || against === undefined) return pr.state.toLowerCase()

  const mergeSha =
    'mergeCommit' in pr &&
    typeof pr.mergeCommit === 'object' &&
    pr.mergeCommit !== null &&
    'oid' in pr.mergeCommit &&
    typeof pr.mergeCommit.oid === 'string'
      ? pr.mergeCommit.oid
      : undefined
  if (mergeSha === undefined) return 'merged'

  const comparison = output('gh', [
    'api',
    `repos/${repository}/compare/${mergeSha}...${against}`,
    '--jq',
    '.status',
  ])
  return comparison === 'ahead' || comparison === 'identical'
    ? `merged, in ${against}: drop this patch`
    : `merged, not in ${against}`
}

const commits = readPatchCommits({ base: pin.commit, head: 'offload' })

console.log(`Payload ${pin.tag}, ${commits.length} patch(es)\n`)
for (const commit of commits) {
  console.log(`${commit.id}: ${commit.subject}`)
  console.log(`  upstream:  ${commit.upstream ?? '-'} (${upstreamState(commit.upstream)})`)
  console.log(`  drop when: ${commit.dropWhen}`)
  console.log(`  tests:     ${commit.tests}\n`)
}
