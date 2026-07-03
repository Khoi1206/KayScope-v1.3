import { getRedisClient } from '@/lib/redis'
import { findFlowRunById } from '@/db/queries/flow_runs'
import { findFlowById } from '@/db/queries/flows'
import { executeFlowRun } from './flow-runner'
import logger from '@/lib/logger'

const QUEUE_KEY = 'flow-run-queue'

// Bounded concurrency is the whole point of the queue: production is a
// persistent Node server (same as dev — this app has no serverless deploy
// target, see CLAUDE.md), so `npx playwright` *can* spawn there — the risk
// being guarded against is a burst of "Run Flow" clicks forking unbounded
// concurrent Playwright processes on the box also serving HTTP requests.
// Requires Playwright + its browsers to be installed on whichever process
// runs the worker loop — an operational precondition, not something this
// code can satisfy on its own.
const WORKER_CONCURRENCY = Number(process.env.FLOW_RUN_WORKER_CONCURRENCY ?? 2)

declare global {
  // eslint-disable-next-line no-var
  var __flowRunWorkersStarted: boolean | undefined
}

export async function enqueueFlowRun(runId: string): Promise<void> {
  await getRedisClient().lpush(QUEUE_KEY, runId)
}

/** Idempotent — safe to call on every request; only starts workers once per process. */
export function startFlowRunWorkers(): void {
  if (globalThis.__flowRunWorkersStarted) return
  globalThis.__flowRunWorkersStarted = true
  for (let i = 0; i < WORKER_CONCURRENCY; i++) {
    void workerLoop(i)
  }
  logger.info(`Flow run queue: started ${WORKER_CONCURRENCY} worker(s)`)
}

async function workerLoop(workerId: number): Promise<void> {
  // BRPOP blocks the connection it's called on — a dedicated duplicate keeps
  // this loop's blocking wait from starving whatever else uses the shared client.
  const blockingClient = getRedisClient().duplicate()
  for (;;) {
    try {
      const popped = await blockingClient.brpop(QUEUE_KEY, 5)
      if (!popped) continue // 5s poll timeout with nothing queued — loop again
      const [, runId] = popped
      await processQueuedRun(runId).catch(err =>
        logger.error(err, `Flow run worker ${workerId}: job ${runId} failed`)
      )
    } catch (err) {
      logger.error(err, `Flow run worker ${workerId}: queue error, backing off`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function processQueuedRun(runId: string): Promise<void> {
  const run = await findFlowRunById(runId)
  if (!run) {
    logger.warn(`Flow run worker: run ${runId} not found, skipping`)
    return
  }
  const flow = await findFlowById(run.flowId)
  if (!flow) {
    logger.warn(`Flow run worker: flow ${run.flowId} not found for run ${runId}, skipping`)
    return
  }
  await executeFlowRun(flow, run)
}
