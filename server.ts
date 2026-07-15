import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { connect, type Socket } from 'node:net'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import httpProxy from 'http-proxy'
import { getToken } from 'next-auth/jwt'

const dev = process.env.NODE_ENV !== 'production'

loadEnvConfig(process.cwd(), dev)

const hostname = process.env.HOSTNAME || '0.0.0.0'
const externalPort = parseInt(process.env.PORT || '3008', 10)
// Internal-only — Next.js binds this on 127.0.0.1, never exposed externally.
// Override with INTERNAL_PORT if `externalPort + 1` happens to collide with
// something else already running on the host.
const internalPort = parseInt(process.env.INTERNAL_PORT || String(externalPort + 1), 10)

const SESSIONS_DIR = path.join(process.cwd(), 'tests', 'e2e', 'generated', '.ui-sessions')
const PROXY_PREFIX = '/flow-ui-proxy/'

type UiSession = { pid: number; startedAt: number; port: number }

/** Reads the session file written by POST /api/flows/[id]/ui — the cross-module contract for which local port to proxy to. */
function readUiSession(flowId: string): UiSession | null {
  try {
    const raw = readFileSync(path.join(SESSIONS_DIR, `${flowId}.json`), 'utf8')
    const parsed = JSON.parse(raw) as Partial<UiSession>
    if (!parsed.port) return null
    return parsed as UiSession
  } catch {
    return null
  }
}

/** Only the pathname is ever needed — a fixed base is enough to parse a relative request URL with the WHATWG URL API. */
function pathnameOf(url: string | undefined): string {
  return new URL(url || '/', 'http://internal').pathname
}

function parseFlowIdFromPath(pathname: string): { flowId: string; rest: string } | null {
  if (!pathname.startsWith(PROXY_PREFIX)) return null
  const remainder = pathname.slice(PROXY_PREFIX.length) // "<flowId>/rest..."
  const slashIdx = remainder.indexOf('/')
  const flowId = slashIdx === -1 ? remainder : remainder.slice(0, slashIdx)
  const rest = slashIdx === -1 ? '/' : remainder.slice(slashIdx)
  if (!flowId) return null
  return { flowId, rest: rest || '/' }
}

/**
 * Raw-socket WS forward — not http-proxy's `.ws()`, which silently failed
 * the handshake here (upstream never saw the request; browser reported
 * "Connection closed before receiving a handshake response" with zero
 * server-side error). Replaying the upgrade request line + headers over a
 * plain net.connect() is the standard WS-proxy technique and has no such
 * dependency. `rewriteHost`, when set, overrides the Host/Origin headers to
 * match the real target — needed for the Playwright ui-host target (it
 * silently drops handshakes whose Host/Origin don't match itself); NOT used
 * for the Next.js passthrough target, which expects to see the original
 * external Host so its own AUTH_URL/cookie logic stays consistent.
 */
function forwardUpgrade(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  targetPort: number,
  targetPath: string,
  rewriteHost: boolean
) {
  const upstream = connect(targetPort, '127.0.0.1', () => {
    const hostHeader = `127.0.0.1:${targetPort}`
    const originHeader = `http://127.0.0.1:${targetPort}`
    const requestLines = [`GET ${targetPath} HTTP/1.1`]
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i]
      if (rewriteHost && name.toLowerCase() === 'host') {
        requestLines.push(`Host: ${hostHeader}`)
      } else if (rewriteHost && name.toLowerCase() === 'origin') {
        requestLines.push(`Origin: ${originHeader}`)
      } else {
        requestLines.push(`${name}: ${req.rawHeaders[i + 1]}`)
      }
    }
    requestLines.push('', '')
    upstream.write(requestLines.join('\r\n'))
    if (head?.length) upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('close', () => upstream.destroy())
  socket.on('error', () => upstream.destroy())
}

async function waitForServer(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) })
      if (res.status < 500) return true
    } catch {
      // Not up yet — keep polling
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return false
}

async function main() {
  // --- Spawn the real Next.js process, completely unmodified, on the internal port ---
  const nextCommand = dev ? 'next dev' : 'next start'
  const nextChild = spawn(`npx ${nextCommand} -p ${internalPort} -H 127.0.0.1`, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(internalPort) },
  })
  nextChild.on('exit', (code) => {
    // eslint-disable-next-line no-console
    console.error(`Next.js process exited with code ${code} — shutting down sidecar`)
    process.exit(code ?? 1)
  })
  const shutdown = () => { nextChild.kill(); process.exit(0) }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  const nextReady = await waitForServer(internalPort, 120000)
  if (!nextReady) {
    // eslint-disable-next-line no-console
    console.error('Next.js did not become ready in time')
    nextChild.kill()
    process.exit(1)
  }

  // Deferred until after loadEnvConfig() has run — see comment above.
  const [{ findFlowById }, { getEffectiveRole }, { default: logger }] = await Promise.all([
    import('@/db/queries/flows'),
    import('@/lib/auth/workspace-guard'),
    import('@/lib/logger'),
  ])

  // Plain HTTP passthrough to Next.js — no changeOrigin, so Next.js still
  // sees the original external Host header and stays consistent with its
  // own configured AUTH_URL/NEXTAUTH_URL.
  const nextProxy = httpProxy.createProxyServer({ target: `http://127.0.0.1:${internalPort}` })
  nextProxy.on('error', (err) => logger.warn(err, 'Sidecar: Next.js passthrough proxy error'))

  const flowUiProxy = httpProxy.createProxyServer()
  flowUiProxy.on('error', (err) => logger.warn(err, 'Sidecar: Flow UI HTTP proxy error'))

  // A UI-mode session's initial page load fires many concurrent asset/WS
  // requests — cache the authorization decision briefly instead of re-querying
  // the DB on every single one.
  const AUTH_CACHE_MS = 5000
  const authCache = new Map<string, { ok: boolean; expiresAt: number }>()

  async function isAuthorizedForFlow(flowId: string, cookieHeader: string | undefined): Promise<boolean> {
    const cacheKey = `${flowId}:${cookieHeader ?? ''}`
    const cached = authCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.ok

    const ok = await (async () => {
      try {
        const token = await getToken({
          req: { headers: { cookie: cookieHeader ?? '' } },
          secret: process.env.AUTH_SECRET,
          secureCookie: process.env.AUTH_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production',
        })
        const userId = token?.id as string | undefined
        if (!userId) return false
        const flow = await findFlowById(flowId)
        if (!flow) return false
        const role = await getEffectiveRole(flow.workspaceId, userId)
        return role !== null
      } catch (err) {
        logger.warn(err, 'Flow UI proxy: authorization check failed')
        return false
      }
    })()

    authCache.set(cacheKey, { ok, expiresAt: Date.now() + AUTH_CACHE_MS })
    return ok
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const match = parseFlowIdFromPath(pathnameOf(req.url))
    if (match) {
      const session = readUiSession(match.flowId)
      if (!session) {
        res.statusCode = 404
        res.end('No running Test UI session for this flow')
        return
      }
      const authorized = await isAuthorizedForFlow(match.flowId, req.headers.cookie)
      if (!authorized) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      req.url = match.rest
      flowUiProxy.web(req, res, { target: `http://127.0.0.1:${session.port}` })
      return
    }
    nextProxy.web(req, res)
  })

  server.on('upgrade', async (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const match = parseFlowIdFromPath(pathnameOf(req.url))
    if (match) {
      const session = readUiSession(match.flowId)
      if (!session) {
        socket.destroy()
        return
      }
      const authorized = await isAuthorizedForFlow(match.flowId, req.headers.cookie)
      if (!authorized) {
        socket.destroy()
        return
      }
      forwardUpgrade(req, socket, head, session.port, match.rest, true)
      return
    }
    // Next's own HMR / any future WS usage — Next.js handles this itself,
    // completely normally, since it's an unmodified `next dev`/`next start`
    // process from its own point of view.
    forwardUpgrade(req, socket, head, internalPort, req.url || '/', false)
  })

  server.listen(externalPort, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`> Sidecar ready on http://${hostname}:${externalPort} -> Next.js on 127.0.0.1:${internalPort} (${dev ? 'development' : 'production'})`)
  })
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
