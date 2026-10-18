import { fail, vendorGitOutput } from '../lib.ts'

/**
 * An Offload patch is one commit on the `offload` branch. Its message carries
 * the intent in the body and these trailers:
 *
 *   Offload-Patch: <stable id>
 *   Upstream: <PR or issue URL>            (optional)
 *   Drop-When: <condition for deleting the patch>
 *   Tests: <commands that prove the patch works>
 */
export type PatchCommit = {
  dropWhen: string
  id: string
  intent: string
  sha: string
  subject: string
  tests: string
  upstream: string | undefined
}

const trailerKeys = ['Offload-Patch', 'Upstream', 'Drop-When', 'Tests'] as const
const fieldSeparator = '\x1f'
const recordSeparator = '\x1e'

export const readPatchCommits = ({ base, head }: { base: string; head: string }): PatchCommit[] => {
  const format = [
    '%H',
    '%s',
    ...trailerKeys.map((key) => `%(trailers:key=${key},valueonly,separator=%x2C )`),
    '%b',
  ].join('%x1f')

  return vendorGitOutput(['log', '--reverse', `--format=${format}%x1e`, `${base}..${head}`])
    .split(recordSeparator)
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [sha = '', subject = '', id = '', upstream = '', dropWhen = '', tests = '', body = ''] =
        record.split(fieldSeparator)
      const intent = body
        .split('\n')
        .filter((line) => !trailerKeys.some((key) => line.startsWith(`${key}:`)))
        .join('\n')
        .trim()

      const missing = [
        id === '' && 'Offload-Patch',
        dropWhen === '' && 'Drop-When',
        tests === '' && 'Tests',
        intent === '' && 'an intent paragraph',
      ].filter((name) => name !== false)
      if (missing.length > 0) {
        return fail(`Patch "${subject}" (${sha.slice(0, 9)}) is missing ${missing.join(', ')}.`)
      }

      return {
        dropWhen: dropWhen.trim(),
        id: id.trim(),
        intent,
        sha,
        subject,
        tests: tests.trim(),
        upstream: upstream.trim() === '' ? undefined : upstream.trim(),
      }
    })
}
