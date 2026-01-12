import * as p from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { zeroId } from 'zero-id'
import { user } from './auth'

const id = () => zeroId({ randomLength: 32 })

export const osTypeEnum = p.pgEnum('os_type', ['ios', 'android', 'macos', 'windows', 'linux'])

export const device = p.pgTable('devices', () => ({
  id: p.text().primaryKey().$defaultFn(id),
  name: p.text().notNull(),
  active: p.boolean().default(false),
  userId: p.text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  osType: osTypeEnum('os_type'),
  lastSeenAt: p.timestamp('last_seen_at'),
  licenseKey: p.text('license_key').notNull(),
  deviceToken: p
    .text('device_token')
    .notNull()
    .$defaultFn(() => zeroId({ randomLength: 64 })),
  createdAt: p.timestamp('created_at').notNull().defaultNow(),
  updatedAt: p
    .timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}))

export const deviceRelations = relations(device, ({ one }) => ({
  user: one(user, {
    fields: [device.userId],
    references: [user.id],
  }),
}))
