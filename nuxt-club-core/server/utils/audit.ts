import { getRequestIP, getHeader } from 'h3'
import type { H3Event } from 'h3'
import type { ClubAuditAction } from '../../types/auth'

export interface RecordAuditLogOptions {
  userId?: string | number
  email?: string
  metadata?: Record<string, any>
}

/**
 * Zaznamená auditní log události a vyvolá Nitro hook 'auth:audit-log'.
 * Automaticky získá IP adresu a User-Agent z H3Event.
 */
export async function recordAuditLog(
  event: H3Event,
  action: ClubAuditAction,
  options?: RecordAuditLogOptions
): Promise<void> {
  const ip = getRequestIP(event, { xForwardedFor: true }) || '127.0.0.1'
  const userAgent = getHeader(event, 'user-agent') || undefined
  const timestamp = new Date()

  const nitroApp = useNitroApp()
  await nitroApp.hooks.callHook('auth:audit-log', {
    action,
    userId: options?.userId,
    email: options?.email,
    ip,
    userAgent,
    metadata: options?.metadata,
    timestamp
  })
}
