import { Resend } from 'resend'
import { env } from '@/lib/env'

export const emailer = new Resend(env.USESEND_API_KEY)
