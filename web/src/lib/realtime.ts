import { Realtime, InferRealtimeEvents } from '@upstash/realtime'
import { Redis } from '@upstash/redis'
import { z } from 'zod/v4'

const redis = Redis.fromEnv()

const schema = {
  messages: {
    content: z.string(),
  },

  userBackend: {
    changesSaved: z.object({
      message: z.string(),
    }),
  },
}

export const realtime = new Realtime({ schema, redis })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
