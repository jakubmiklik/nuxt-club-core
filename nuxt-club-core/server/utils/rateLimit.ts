import { getRequestIP, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'
import { createClubError } from './errors'

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory store pro sledování pokusů
const rateLimitStore = new Map<string, RateLimitRecord>()

export interface RateLimitOptions {
  key: string
  maxAttempts: number
  windowSeconds: number
}

/**
 * Kontrola rate limitu pro daný request.
 * Využívá klientskou IP adresu a zadaný klíč (např. 'login', 'register').
 *
 * @param event H3Event requestu
 * @param options Nastavení limitu (key, maxAttempts, windowSeconds)
 */
export async function checkRateLimit(
  event: H3Event,
  options: { key: string; maxAttempts: number; windowSeconds: number }
): Promise<void> {
  const { key, maxAttempts, windowSeconds } = options

  // 1. Získání klientské IP adresy s fallbackem na 127.0.0.1
  let clientIp = '127.0.0.1'
  try {
    clientIp = getRequestIP(event, { xForwardedFor: true }) || '127.0.0.1'
  } catch {
    clientIp = '127.0.0.1'
  }
  const storageKey = `${key}:${clientIp}`
  const now = Date.now()

  // 2. Vyhledání stávajícího záznamu a pročištění prošlých
  let record = rateLimitStore.get(storageKey)

  if (!record || now >= record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowSeconds * 1000
    }
    rateLimitStore.set(storageKey, record)
  }

  // Občasné pročištění starých záznamů z paměti pro zamezení memory leaků
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now >= v.resetTime) {
        rateLimitStore.delete(k)
      }
    }
  }

  // 3. Inkrementace počtu pokusů
  record.count += 1

  const remaining = Math.max(0, maxAttempts - record.count)
  const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000))

  // 4. Nastavení standardních hlaviček Rate Limitingu
  setResponseHeader(event, 'X-RateLimit-Limit', maxAttempts)
  setResponseHeader(event, 'X-RateLimit-Remaining', remaining)

  // 5. Ověření překročení limitu
  if (record.count > maxAttempts) {
    setResponseHeader(event, 'Retry-After', retryAfter)

    throw createClubError({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.'
    })
  }
}
