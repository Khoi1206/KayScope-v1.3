import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, rm } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { createFlowRun, finalizeFlowRun } from '@/db/queries/flow_runs'
import { generateFlowSpec } from '@/lib/codegen/flow-playwright'
import type { PlaywrightRunResult, FlowRunSummary } from '@/db/schema'
import logger from '@/lib/logger'

const execAsync = promisify(exec)

// Each run gets its own subdirectory so concurrent runs don't pick up each other's specs
const GENERATED_BASE = path.join(process.cwd(), 'tests', 'e2e', 'generated')
// Normalize to forward slashes — Windows backslashes break Playwright's CLI path parser
const BUILDER_CONFIG = path.join(process.cwd(), 'playwright.builder.config.ts').replace(/\\/g, '/')

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Flow execution is disabled in production' }, { status: 403 })
  }

  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await requireActiveWorkspace(req, session.user.id).catch(() => null)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const flow = await findFlowByIdForWorkspace(id, workspace.id)
  if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })

  const run = await createFlowRun({
    workspaceId: workspace.id,
    flowId: flow.id,
    flowName: flow.name,
    triggeredBy: session.user.id,
  })

  // Each run gets an isolated subdirectory so concurrent runs don't interfere
  const runDir = path.join(GENERATED_BASE, `run-${randomUUID()}`)

  try {
    // 1. Generate the .spec.ts file inside an isolated run directory
    const specContent = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges })

    await mkdir(runDir, { recursive: true })
    const specFile = path.join(runDir, `flow.spec.ts`)
    await writeFile(specFile, specContent, 'utf8')

    // 2. Run Playwright against only this run's directory.
    // Pass --testDir as a CLI override so only this run's spec is picked up,
    // isolating concurrent runs from each other.
    // Use execAsync (not spawnSync) so test failures (exit code 1) don't throw —
    // we still need stdout to parse the JSON reporter output.
    const runDirFwd = runDir.replace(/\\/g, '/')
    let stdout = ''
    let stderr = ''
    const projectFlags = flow.browsers.map(b => `--project=${b}`).join(' ')
    try {
      const result = await execAsync(
        `npx playwright test --config="${BUILDER_CONFIG}" ${projectFlags} --reporter=json`,
        {
          cwd: process.cwd(),
          timeout: 120_000,
          maxBuffer: 20 * 1024 * 1024,
          env: { ...process.env, PLAYWRIGHT_TEST_DIR: runDirFwd },
        }
      )
      stdout = result.stdout
      stderr = result.stderr
    } catch (execErr: unknown) {
      // Playwright exits with code 1 when tests fail — output is still valid JSON
      const err = execErr as { stdout?: string; stderr?: string }
      stdout = err.stdout ?? ''
      stderr = err.stderr ?? ''
    }

    // 3. Parse the JSON reporter output (find first '{' to skip any leading noise)
    const jsonStart = stdout.indexOf('{')
    const rawOutput = stdout

    let testResults: PlaywrightRunResult
    try {
      if (jsonStart === -1) throw new Error('No JSON in stdout')
      const json = JSON.parse(stdout.slice(jsonStart)) as {
        stats?: { total?: number; passed?: number; failed?: number; skipped?: number; duration?: number }
        suites?: Array<{
          specs?: Array<{
            tests?: Array<{
              title?: string
              results?: Array<{ status?: string; duration?: number; error?: { message?: string } }>
            }>
          }>
        }>
      }

      const stats = json.stats ?? {}
      const tests: PlaywrightRunResult['tests'] = []

      // Playwright JSON reporter nests suites inside suites.
      // Traverse recursively to collect all specs.
      type PwSuite = {
        suites?: PwSuite[]
        specs?: Array<{
          title?: string
          tests?: Array<{
            projectName?: string
            results?: Array<{ status?: string; duration?: number; errors?: Array<{ message?: string }> }>
          }>
        }>
      }
      // With multiple projects each project gets its own suite copy, so spec.tests.length
      // is always 1 per suite — use browser count instead to decide whether to suffix.
      const multiProject = flow.browsers.length > 1
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
            })
          }
        }
        for (const child of suite.suites ?? []) {
          collectTests(child)
        }
      }
      for (const suite of json.suites ?? []) collectTests(suite)

      // Playwright JSON uses stats.unexpected (failures) and stats.expected (passes),
      // not stats.failed / stats.passed
      const pwStats = stats as Record<string, number>
      const statsFailed = pwStats.unexpected ?? tests.filter(t => t.status !== 'passed' && t.status !== 'skipped').length
      const statsPassed = pwStats.expected ?? tests.filter(t => t.status === 'passed').length
      const statsSkipped = pwStats.skipped ?? 0
      const statsTotal = statsFailed + statsPassed + statsSkipped

      testResults = {
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
      // JSON parse failed — Playwright may have crashed or produced no output
      testResults = {
        success: false,
        summary: { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 },
        tests: [],
        rawOutput: (stderr + rawOutput).slice(0, 10_000),
      }
    }

    const summary: FlowRunSummary = {
      total: testResults.summary.total,
      passed: testResults.summary.passed,
      failed: testResults.summary.failed,
      duration: testResults.summary.duration,
    }

    const status = testResults.success ? 'passed' : 'failed'
    const finalRun = await finalizeFlowRun(run.id, { testResults, summary, status })

    // Clean up the isolated run directory (best-effort — don't fail the response on error)
    rm(runDir, { recursive: true, force: true }).catch(e =>
      logger.warn(e, 'Flow run: failed to clean up temp spec dir')
    )

    return NextResponse.json({ run: finalRun, testResults })
  } catch (err) {
    logger.error(err, 'Flow run error')
    const message = err instanceof Error ? err.message : 'Run failed'
    await finalizeFlowRun(run.id, {
      testResults: null,
      summary: { total: 0, passed: 0, failed: 0, duration: 0 },
      status: 'errored',
    })
    // Best-effort cleanup even on error
    rm(runDir, { recursive: true, force: true }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
