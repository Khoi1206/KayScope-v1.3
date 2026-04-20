import type IORedis from 'ioredis'

const RATE_LIMIT = 30
const RATE_WINDOW_SECS = 60

// Atomically increment and set TTL only on the first request in a window.
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`

export async function checkRateLimit(ip: string, redis: IORedis): Promise<boolean> {
  const key = `ratelimit:${ip}`
  const count = (await redis.eval(RATE_LIMIT_SCRIPT, 1, key, String(RATE_WINDOW_SECS))) as number
  return count <= RATE_LIMIT
}
