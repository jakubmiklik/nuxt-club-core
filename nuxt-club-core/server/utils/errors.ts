import { createError } from 'h3'
import type { ClubAuthErrorCode, ClubErrorResponse } from '../../types/auth'

export interface CreateClubErrorOptions {
  statusCode: number
  code: ClubAuthErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

/**
 * Vytvoří H3 chybu s jednotným formátem ClubErrorResponse.
 */
export function createClubError(options: CreateClubErrorOptions) {
  const errorPayload: ClubErrorResponse = {
    statusCode: options.statusCode,
    code: options.code,
    message: options.message,
    ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {})
  }

  return createError({
    statusCode: options.statusCode,
    statusMessage: options.message,
    message: options.message,
    data: errorPayload
  })
}
