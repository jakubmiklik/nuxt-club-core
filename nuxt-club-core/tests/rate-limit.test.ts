import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit } from '../server/utils/rateLimit'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

describe('Rate Limiting (checkRateLimit)', () => {
  function createMockEvent(ip: string = '192.168.1.100') {
    const socket = new Socket()
    const req = new IncomingMessage(socket)
    req.headers = {
      'x-forwarded-for': ip
    }

    const res = new ServerResponse(req)
    const event = createEvent(req, res)
    event.context = event.context || {}
    event.context.clientAddress = ip

    return {
      event,
      res
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('allows requests within maxAttempts limit', async () => {
    const { event, res } = createMockEvent('10.0.0.1')
    const key = `test-limit-${Date.now()}`

    // Attempt 1 / 3
    await expect(checkRateLimit(event, { key, maxAttempts: 3, windowSeconds: 60 })).resolves.toBeUndefined()
    expect(res.getHeader('X-RateLimit-Limit')).toBe(3)
    expect(res.getHeader('X-RateLimit-Remaining')).toBe(2)

    // Attempt 2 / 3
    await expect(checkRateLimit(event, { key, maxAttempts: 3, windowSeconds: 60 })).resolves.toBeUndefined()
    expect(res.getHeader('X-RateLimit-Remaining')).toBe(1)

    // Attempt 3 / 3
    await expect(checkRateLimit(event, { key, maxAttempts: 3, windowSeconds: 60 })).resolves.toBeUndefined()
    expect(res.getHeader('X-RateLimit-Remaining')).toBe(0)
  })

  it('throws 429 RATE_LIMITED when exceeding maxAttempts', async () => {
    const { event, res } = createMockEvent('10.0.0.2')
    const key = `test-exceed-${Date.now()}`

    // 2 allowed attempts
    await checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 60 })
    await checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 60 })

    // 3rd attempt exceeds limit
    await expect(
      checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 60 })
    ).rejects.toMatchObject({
      statusCode: 429,
      data: {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.'
      }
    })

    // Retry-After header should be set
    expect(Number(res.getHeader('Retry-After'))).toBeGreaterThanOrEqual(1)
  })

  it('differentiates between different IP addresses for the same key', async () => {
    const key = `test-ip-diff-${Date.now()}`
    const clientA = createMockEvent('192.168.1.1')
    const clientB = createMockEvent('192.168.1.2')

    // Client A uses up all 2 attempts
    await checkRateLimit(clientA.event, { key, maxAttempts: 2, windowSeconds: 60 })
    await checkRateLimit(clientA.event, { key, maxAttempts: 2, windowSeconds: 60 })

    // Client A 3rd attempt fails
    await expect(checkRateLimit(clientA.event, { key, maxAttempts: 2, windowSeconds: 60 })).rejects.toMatchObject({
      statusCode: 429
    })

    // Client B still has quota
    await expect(checkRateLimit(clientB.event, { key, maxAttempts: 2, windowSeconds: 60 })).resolves.toBeUndefined()
    expect(clientB.res.getHeader('X-RateLimit-Remaining')).toBe(1)
  })

  it('resets window after windowSeconds expires', async () => {
    const { event, res } = createMockEvent('10.0.0.3')
    const key = `test-reset-${Date.now()}`

    let currentTime = 1000000
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    // Attempt 1 and 2 of 2
    await checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 10 })
    await checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 10 })

    // Next attempt fails
    await expect(checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 10 })).rejects.toMatchObject({
      statusCode: 429
    })

    // Advance time past the window (10 seconds = 10000ms)
    currentTime += 11000

    // After reset, request should succeed again with refreshed remaining count
    await expect(checkRateLimit(event, { key, maxAttempts: 2, windowSeconds: 10 })).resolves.toBeUndefined()
    expect(res.getHeader('X-RateLimit-Remaining')).toBe(1)
  })
})
