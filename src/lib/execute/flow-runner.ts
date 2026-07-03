import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, rm } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { finalizeFlowRun, findFlowRunIdsBeyondLimit } from '@/db/queries/flow_runs'
import { generateFlowSpec } from '@/lib/codegen/flow-playwright'
import { loadFlowScopes } from '@/lib/codegen/flow-scopes'
import { parsePlaywrightJsonReport } from '@/lib/codegen/playwright-report-parser'
import type { Flow, FlowRun, FlowRunSummary } from '@/db/schema'
import logger from '@/lib/logger'

const execAsync = promisify(exec)

const GENERATED_BASE = path.join(process.cwd(), 'tests', 'e2e', 'generated')
// Normalize to forward slashes — Windows backslashes break Playwright's CLI path parser
const BUILDER_CONFIG = path.join(process.cwd(), 'playwright.builder.config.ts').replace(/\\/g, '/')

// Artifact directories persist on disk indefinitely (unlike runDir) so historical
// runs can still show screenshots/videos — cap how many runs' worth of artifacts
// a single flow keeps on disk, or usage grows unbounded run after run.
const KEEP_ARTIFACT_RUNS_PER_FLOW = 20

/** Best-effort: deletes on-disk artifact directories for old runs of this flow, keeping the most recent N. Never throws. */
async function pruneOldArtifacts(flowId: string) {
  try {
    const staleIds = await findFlowRunIdsBeyondLimit(flowId, KEEP_ARTIFACT_RUNS_PER_FLOW)
    await Promise.all(
      staleIds.map(runId => rm(path.join(GENERATED_BASE, 'artifacts', runId), { recursive: true, force: true }))
    )
  } catch (e) {
    logger.warn(e, 'Flow run: failed to prune old artifact directories')
  }
}

/**
 * Generates a flow's spec file, runs it via the Playwright CLI, parses the
 * result, and persists it onto the given (already-created) `flow_runs` row.
 *
 * Shared by two callers: `POST /api/flows/[id]/run` (dev — runs inline,
 * request stays open until it finishes) and the Redis-backed worker in
 * `flow-run-queue.ts` (production — runs out of the request/response cycle,
 * bounded to a small worker-pool concurrency so a burst of "Run Flow" clicks
 * can't fork unbounded `npx playwright` processes on the server).
 */
export async function executeFlowRun(flow: Flow, run: FlowRun) {
  // Each run gets an isolated subdirectory so concurrent runs don't interfere
  const runDir = path.join(GENERATED_BASE, `run-${randomUUID()}`)
  // Screenshots/videos/traces are kept in a separate, persistent-per-run-id
  // directory — unlike runDir, artifacts need to survive so historical runs
  // can still show them.
  const artifactsDir = path.join(GENERATED_BASE, 'artifacts', run.id)

  try {
    // 1. Generate the .spec.ts file inside an isolated run directory.
    // {{variable}} tokens in node fields are resolved against the flow's bound
    // environment + workspace globals, decrypted server-side — never sent to the client.
    const { scopes, dynamicVars } = await loadFlowScopes(flow)
    const specContent = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges, scopes, dynamicVars })

    await mkdir(runDir, { recursive: true })
    await mkdir(artifactsDir, { recursive: true })
    const specFile = path.join(runDir, `flow.spec.ts`)
    await writeFile(specFile, specContent, 'utf8')

    // 2. Run Playwright against only this run's directory.
    // Pass --testDir as a CLI override so only this run's spec is picked up,
    // isolating concurrent runs from each other.
    // Use execAsync (not spawnSync) so test failures (exit code 1) don't throw —
    // we still need stdout to parse the JSON reporter output.
    const runDirFwd = runDir.replace(/\\/g, '/')
    const artifactsDirFwd = artifactsDir.replace(/\\/g, '/')
    const RUN_TIMEOUT_MS = flow.timeoutMs
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const projectFlags = flow.browsers.map((b: string) => `--project=${b}`).join(' ')
    try {
      const result = await execAsync(
        `npx playwright test --config="${BUILDER_CONFIG}" ${projectFlags} --reporter=json`,
        {
          cwd: process.cwd(),
          timeout: RUN_TIMEOUT_MS,
          maxBuffer: 20 * 1024 * 1024,
          env: { ...process.env, PLAYWRIGHT_TEST_DIR: runDirFwd, PLAYWRIGHT_OUTPUT_DIR: artifactsDirFwd },
        }
      )
      stdout = result.stdout
      stderr = result.stderr
    } catch (execErr: unknown) {
      // Playwright exits with code 1 when tests fail — output is still valid JSON.
      // Node marks a timeout-killed child with `killed: true` (it's the one thing
      // that distinguishes "we killed it after the timeout" from "Playwright crashed").
      const err = execErr as { stdout?: string; stderr?: string; killed?: boolean }
      stdout = err.stdout ?? ''
      stderr = err.stderr ?? ''
      timedOut = Boolean(err.killed)
    }

    // 3. Parse the JSON reporter output.
    const testResults = parsePlaywrightJsonReport({
      stdout,
      stderr,
      multiProject: flow.browsers.length > 1,
      timedOut,
      timeoutMs: RUN_TIMEOUT_MS,
      artifactsDir,
    })

    const summary: FlowRunSummary = {
      total: testResults.summary.total,
      passed: testResults.summary.passed,
      failed: testResults.summary.failed,
      duration: testResults.summary.duration,
    }

    const status = timedOut ? 'timedOut' : testResults.success ? 'passed' : 'failed'
    const finalRun = await finalizeFlowRun(run.id, { testResults, summary, status })

    // Clean up the isolated run directory (best-effort — don't fail on error)
    rm(runDir, { recursive: true, force: true }).catch(e =>
      logger.warn(e, 'Flow run: failed to clean up temp spec dir')
    )
    void pruneOldArtifacts(flow.id)

    return { run: finalRun, testResults }
  } catch (err) {
    logger.error(err, 'Flow run error')
    const message = err instanceof Error ? err.message : 'Run failed'
    await finalizeFlowRun(run.id, {
      testResults: null,
      summary: { total: 0, passed: 0, failed: 0, duration: 0 },
      status: 'errored',
    })
    rm(runDir, { recursive: true, force: true }).catch(() => {})
    void pruneOldArtifacts(flow.id)
    throw new Error(message)
  }
}
