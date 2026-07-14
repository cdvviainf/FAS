import { Queue, Worker, QueueEvents } from 'bullmq'
import type { Processor } from 'bullmq'
import { env } from '../config/env.js'

// BullMQ bundlea su propia ioredis — pasar opciones, nunca instancia externa
function parseRedisUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  }
}

const connection = parseRedisUrl(env.REDIS_URL)

export function createQueue(name: string) {
  return new Queue(name, { connection })
}

export function createWorker(name: string, processor: Processor) {
  return new Worker(name, processor, { connection })
}

export function createQueueEvents(name: string) {
  return new QueueEvents(name, { connection })
}

export const cobranzaQueue = createQueue('cobranza')
