import IORedis from 'ioredis'

let client: IORedis | null = null

export function getRedisClient(): IORedis {
  if (!client) {
    client = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    })
  }
  return client
}
