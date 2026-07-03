import path from 'path'
import type { PlaywrightRunResult, PlaywrightAttachment } from '@/db/schema'

export interface ParsePlaywrightReportInput {
  stdout: string
  stderr: string
  /** Multiple browser projects mean each gets its own suite copy — suffix test names with `[project]` to disambiguate. */
  multiProject: boolean
  /** True when the run was killed for exceeding the CLI timeout, rather than failing/crashing on its own. */
  timedOut: boolean
  timeoutMs: number
  /**
   * Absolute path to this run's Playwright `outputDir`. Screenshot/video attachment
   * paths in the JSON report are absolute filesystem paths under this directory —
   * stripping the prefix here keeps only a relative path in the stored result, so
   * nothing about the server's directory layout leaks into persisted run data.
   */
  artifactsDir?: string
}

type PwSuite = {
  suites?: PwSuite[]
  specs?: Array<{
    title?: string
    tests?: Array<{
      projectName?: string
      results?: Array<{
        status?: string
        duration?: number
        errors?: Array<{ message?: string }>
        attachments?: Array<{ name?: string; path?: string; contentType?: string }>
      }>
    }>
  }>
}

function toRelAttachments(
  attachments: Array<{ name?: string; path?: string; contentType?: string }> | undefined,
  artifactsDir: string | undefined
): PlaywrightAttachment[] | undefined {
  if (!attachments?.length || !artifactsDir) return undefined
  const rel = attachments
    .filter((a): a is { name: string; path: string; contentType: string } => Boolean(a.path && a.name && a.contentType))
    .map(a => ({
      name: a.name,
      contentType: a.contentType,
      relPath: path.relative(artifactsDir, a.path).replace(/\\/g, '/'),
    }))
    // Guard against an attachment path outside artifactsDir (shouldn't happen, but never trust a path we'll later resolve against disk)
    .filter(a => !a.relPath.startsWith('..'))
  return rel.length > 0 ? rel : undefined
}

/**
 * Parses Playwright's `--reporter=json` stdout into our `PlaywrightRunResult` shape.
 * Extracted from the run route so the parsing logic (and the timeout-vs-crash
 * distinction) can be unit tested without spinning up a real Playwright process.
 */
export function parsePlaywrightJsonReport(input: ParsePlaywrightReportInput): PlaywrightRunResult {
  const { stdout, stderr, multiProject, timedOut, timeoutMs, artifactsDir } = input
  const jsonStart = stdout.indexOf('{')
  const rawOutput = stdout

  try {
    if (jsonStart === -1) throw new Error('No JSON in stdout')
    const json = JSON.parse(stdout.slice(jsonStart)) as {
      stats?: { total?: number; passed?: number; failed?: number; skipped?: number; duration?: number }
      suites?: PwSuite[]
    }

    const tests: PlaywrightRunResult['tests'] = []

    // Playwright JSON reporter nests suites inside suites; with multiple projects
    // each project gets its own suite copy, so spec.tests.length is always 1 per
    // suite — use `multiProject` (browser count) to decide whether to suffix.
    const collectTests = (suite: PwSuite) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const result = t.results?.[0]
          tests.push({
            // Title is on spec, not on the inner test object
            testName: multiProject && t.projectName ? `${spec.title ?? 'Unknown'} [${t.projectName}]` : spec.title ?? 'Unknown',
            status: (result?.status as 'passed' | 'failed' | 'skipped' | 'timedOut') ?? 'failed',
            duration: result?.duration ?? 0,
            // Errors is an array in Playwright JSON reporter
            error: result?.errors?.[0]?.message,
            attachments: toRelAttachments(result?.attachments, artifactsDir),
          })
        }
      }
      for (const child of suite.suites ?? []) collectTests(child)
    }
    for (const suite of json.suites ?? []) collectTests(suite)

    // Playwright JSON uses stats.unexpected (failures) and stats.expected (passes),
    // not stats.failed / stats.passed
    const pwStats = (json.stats ?? {}) as Record<string, number>
    const statsFailed = pwStats.unexpected ?? tests.filter(t => t.status !== 'passed' && t.status !== 'skipped').length
    const statsPassed = pwStats.expected ?? tests.filter(t => t.status === 'passed').length
    const statsSkipped = pwStats.skipped ?? 0
    const statsTotal = statsFailed + statsPassed + statsSkipped

    return {
      success: statsFailed === 0,
      summary: {
        total: statsTotal,
        passed: statsPassed,
        failed: statsFailed,
        skipped: statsSkipped,
        duration: pwStats.duration ?? 0,
      },
      tests,
      rawOutput: (stderr + rawOutput).slice(0, 10_000),
    }
  } catch {
    // JSON parse failed — either the run was killed for exceeding the CLI
    // timeout, or Playwright crashed/produced no output for some other reason.
    return {
      success: false,
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 },
      tests: [],
      rawOutput: timedOut
        ? `Flow run exceeded the ${timeoutMs / 1000}s timeout and was killed before it could report results. This usually means a step is waiting on a selector that never appears, or the flow has too many steps for one run.\n\n${(stderr + rawOutput).slice(0, 9_000)}`
        : (stderr + rawOutput).slice(0, 10_000),
    }
  }
}
