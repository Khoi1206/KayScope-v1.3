// Copies Playwright's static trace viewer SPA (ships inside the playwright-core
// package, nested under @playwright/test -> playwright -> playwright-core in
// pnpm's virtual store) into public/trace-viewer so it can be served same-origin
// and embedded in an iframe — no Electron, no separate tab, no CORS/auth issues
// since it's fetched from our own domain.
import { createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

function resolveNested(pkgName, fromPkgJsonPath) {
  return require.resolve(`${pkgName}/package.json`, { paths: [path.dirname(fromPkgJsonPath)] })
}

function findTraceViewerDir() {
  const testPkgJson = require.resolve('@playwright/test/package.json')
  const playwrightPkgJson = resolveNested('playwright', testPkgJson)
  const corePkgJson = resolveNested('playwright-core', playwrightPkgJson)
  return path.join(path.dirname(corePkgJson), 'lib', 'vite', 'traceViewer')
}

const dest = path.join(process.cwd(), 'public', 'trace-viewer')

let src
try {
  src = findTraceViewerDir()
} catch (err) {
  console.warn('[copy-trace-viewer] could not resolve playwright-core — skipping (trace viewer embed will not work):', err.message)
  process.exit(0)
}

if (!existsSync(src)) {
  console.warn(`[copy-trace-viewer] trace viewer assets not found at ${src} — skipping`)
  process.exit(0)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log(`[copy-trace-viewer] copied Playwright trace viewer assets -> ${path.relative(process.cwd(), dest)}`)
