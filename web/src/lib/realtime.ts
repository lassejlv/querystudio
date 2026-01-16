import { Realtime, InferRealtimeEvents } from '@upstash/realtime'
import { z } from 'zod/v4'
import { redis } from './redis'

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
