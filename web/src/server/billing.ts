import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { polar } from '@/lib/polar'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { db } from 'drizzle'
import { eq } from 'drizzle-orm'
import { user as userTable } from 'drizzle/schema/auth'

export const createCheckout = createServerFn().handler(async () => {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) throw new Error('Unauthorized')

  const { user } = session

  let customerId = ''

  if (!user.polarCustomerId) {
    const newCustomer = await polar.customers.create({ email: user.email, name: user.name })
    await db.update(userTable).set({ polarCustomerId: newCustomer.id }).where(eq(userTable.id, user.id))
    customerId = newCustomer.id
  } else {
    customerId = user.polarCustomerId
  }

  const checkout = await polar.checkouts.create({
    customerId,
    products: [env.POLAR_PRICING_ID],
    allowDiscountCodes: true,
    ...(env.POLAR_EARLY_BIRD_DISCOUNT && { discountId: env.POLAR_EARLY_BIRD_DISCOUNT }),
  })

  return { url: checkout.url }
})

export const createCustomerPortal = createServerFn().handler(async () => {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) throw new Error('Unauthorized')

  const { user } = session

  if (!user.polarCustomerId) throw new Error('No active customerID')

  const portal = await polar.customerSessions.create({
    customerId: user.polarCustomerId,
  })

  return { url: portal.customerPortalUrl }
})
