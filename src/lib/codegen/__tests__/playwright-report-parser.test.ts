import { describe, it, expect } from 'vitest'
import { parsePlaywrightJsonReport } from '../playwright-report-parser'

function jsonReport(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    stats: { expected: 1, unexpected: 0, skipped: 0, duration: 1234 },
    suites: [
      {
        specs: [
          {
            title: 'My Flow',
            tests: [{ projectName: 'chromium', results: [{ status: 'passed', duration: 1234 }] }],
          },
        ],
      },
    ],
    ...overrides,
  })
}

describe('parsePlaywrightJsonReport', () => {
  it('parses a passing single-project report', () => {
    const result = parsePlaywrightJsonReport({
      stdout: jsonReport(),
      stderr: '',
      multiProject: false,
      timedOut: false,
      timeoutMs: 120_000,
    })
    expect(result.success).toBe(true)
    expect(result.summary).toEqual({ total: 1, passed: 1, failed: 0, skipped: 0, duration: 1234 })
    expect(result.tests).toEqual([{ testName: 'My Flow', status: 'passed', duration: 1234, error: undefined }])
  })

  it('does not suffix test names with [project] when multiProject is false', () => {
    const result = parsePlaywrightJsonReport({
      stdout: jsonReport(),
      stderr: '',
      multiProject: false,
      timedOut: false,
      timeoutMs: 120_000,
    })
    expect(result.tests[0]!.testName).toBe('My Flow')
  })

  it('suffixes test names with [project] when multiProject is true', () => {
    const result = parsePlaywrightJsonReport({
      stdout: jsonReport(),
      stderr: '',
      multiProject: true,
      timedOut: false,
      timeoutMs: 120_000,
    })
    expect(result.tests[0]!.testName).toBe('My Flow [chromium]')
  })

  it('collects tests from nested suites (recursive traversal)', () => {
    const stdout = JSON.stringify({
      stats: { expected: 1, unexpected: 1, skipped: 0, duration: 500 },
      suites: [
        {
          suites: [
            {
              specs: [
                { title: 'Nested test', tests: [{ results: [{ status: 'failed', duration: 200, errors: [{ message: 'boom' }] }] }] },
              ],
            },
          ],
          specs: [
            { title: 'Top-level test', tests: [{ results: [{ status: 'passed', duration: 300 }] }] },
          ],
        },
      ],
    })
    const result = parsePlaywrightJsonReport({ stdout, stderr: '', multiProject: false, timedOut: false, timeoutMs: 120_000 })
    expect(result.tests).toHaveLength(2)
    expect(result.tests.map(t => t.testName).sort()).toEqual(['Nested test', 'Top-level test'])
    const failedTest = result.tests.find(t => t.testName === 'Nested test')!
    expect(failedTest.status).toBe('failed')
    expect(failedTest.error).toBe('boom')
  })

  it('marks the report as failed when unexpected > 0', () => {
    const stdout = jsonReport({ stats: { expected: 0, unexpected: 1, skipped: 0, duration: 100 } })
    const result = parsePlaywrightJsonReport({ stdout, stderr: '', multiProject: false, timedOut: false, timeoutMs: 120_000 })
    expect(result.success).toBe(false)
    expect(result.summary.failed).toBe(1)
  })

  it('falls back to a generic crash message when stdout has no JSON and the run did not time out', () => {
    const result = parsePlaywrightJsonReport({
      stdout: 'garbage, no braces here',
      stderr: 'some crash trace',
      multiProject: false,
      timedOut: false,
      timeoutMs: 120_000,
    })
    expect(result.success).toBe(false)
    expect(result.summary).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 })
    expect(result.rawOutput).toContain('some crash trace')
    expect(result.rawOutput).not.toContain('exceeded the')
  })

  it('produces a distinct timeout message when timedOut is true and no JSON was produced', () => {
    const result = parsePlaywrightJsonReport({
      stdout: '',
      stderr: '',
      multiProject: false,
      timedOut: true,
      timeoutMs: 120_000,
    })
    expect(result.success).toBe(false)
    expect(result.rawOutput).toContain('exceeded the 120s timeout')
  })

  it('prefers valid JSON output over the timedOut flag (timeout during cleanup after tests already reported)', () => {
    const result = parsePlaywrightJsonReport({
      stdout: jsonReport(),
      stderr: '',
      multiProject: false,
      timedOut: true,
      timeoutMs: 120_000,
    })
    expect(result.success).toBe(true)
    expect(result.rawOutput).not.toContain('exceeded the')
  })

  it('extracts attachments and strips the artifactsDir prefix into a relative path', () => {
    const stdout = JSON.stringify({
      stats: { expected: 0, unexpected: 1, skipped: 0, duration: 500 },
      suites: [
        {
          specs: [
            {
              title: 'Failing test',
              tests: [
                {
                  results: [
                    {
                      status: 'failed',
                      duration: 500,
                      attachments: [
                        { name: 'screenshot', path: '/artifacts/run-1/failing-test-chromium/test-failed-1.png', contentType: 'image/png' },
                        { name: 'video', path: '/artifacts/run-1/failing-test-chromium/video.webm', contentType: 'video/webm' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    const result = parsePlaywrightJsonReport({
      stdout,
      stderr: '',
      multiProject: false,
      timedOut: false,
      timeoutMs: 120_000,
      artifactsDir: '/artifacts/run-1',
    })
    expect(result.tests[0]!.attachments).toEqual([
      { name: 'screenshot', contentType: 'image/png', relPath: 'failing-test-chromium/test-failed-1.png' },
      { name: 'video', contentType: 'video/webm', relPath: 'failing-test-chromium/video.webm' },
    ])
  })

  it('omits attachments when artifactsDir is not provided', () => {
    const stdout = JSON.stringify({
      stats: { expected: 1, unexpected: 0, skipped: 0, duration: 100 },
      suites: [
        {
          specs: [
            { title: 'Test', tests: [{ results: [{ status: 'passed', duration: 100, attachments: [{ name: 'x', path: '/a/b.png', contentType: 'image/png' }] }] }] },
          ],
        },
      ],
    })
    const result = parsePlaywrightJsonReport({ stdout, stderr: '', multiProject: false, timedOut: false, timeoutMs: 120_000 })
    expect(result.tests[0]!.attachments).toBeUndefined()
  })

  it('caps rawOutput length', () => {
    const hugeStderr = 'x'.repeat(20_000)
    const result = parsePlaywrightJsonReport({
      stdout: 'no json',
      stderr: hugeStderr,
      multiProject: false,
      timedOut: false,
      timeoutMs: 120_000,
    })
    expect(result.rawOutput.length).toBeLessThanOrEqual(10_000)
  })
})
