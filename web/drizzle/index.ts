import { env } from '@/lib/env'
import { drizzle } from 'drizzle-orm/bun-sql'

import * as authSchema from './schema/auth'
import * as deviceSchema from './schema/device'

export const db = drizzle(env.DATABASE_URL, { schema: { ...authSchema, ...deviceSchema } })
