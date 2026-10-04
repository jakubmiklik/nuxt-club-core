import type { FetchError } from 'ofetch'
import type { ClubAuthErrorCode, ClubErrorResponse } from '../../types/auth'

export interface ParsedClubError {
  message: string
  code?: ClubAuthErrorCode
  fieldErrors: Record<string, string>
}

/**
 * Zpracuje libovolnou chybu (např. z $fetch nebo ClubErrorResponse)
 * a vrátí sjednocenou strukturu s chybovou hláškou, kódem a fieldErrors.
 */
export function parseClubError(error: unknown): ParsedClubError {
  const result: ParsedClubError = {
    message: 'Došlo k neočekávané chybě.',
    fieldErrors: {}
  }

  if (!error) {
    return result
  }

  // Případ FetchError nebo objektu s data
  const errObj = error as Record<string, any>
  const data = errObj.data as Partial<ClubErrorResponse> | any

  // 1. Zjistíme kód chyby
  if (data?.code) {
    result.code = data.code as ClubAuthErrorCode
  } else if (errObj.code && typeof errObj.code === 'string') {
    result.code = errObj.code as ClubAuthErrorCode
  }

  // 2. Zjistíme chybovou zprávu
  if (data?.message && typeof data.message === 'string') {
    result.message = data.message
  } else if (errObj.message && typeof errObj.message === 'string') {
    result.message = errObj.message
  } else if (errObj.statusMessage && typeof errObj.statusMessage === 'string') {
    result.message = errObj.statusMessage
  }

  // 3. Zpracujeme fieldErrors
  // Format 1: data.fieldErrors = Record<string, string[]> (z ClubErrorResponse)
  const rawFieldErrors = data?.fieldErrors || errObj.fieldErrors
  if (rawFieldErrors && typeof rawFieldErrors === 'object') {
    for (const [key, val] of Object.entries(rawFieldErrors)) {
      if (Array.isArray(val) && val.length > 0) {
        result.fieldErrors[key] = String(val[0])
      } else if (typeof val === 'string') {
        result.fieldErrors[key] = val
      }
    }
  }

  // Format 2: Fallback pro data.data?.fieldErrors nebo Zod errors array
  const nestedData = data?.data
  if (nestedData?.fieldErrors && typeof nestedData.fieldErrors === 'object') {
    for (const [key, val] of Object.entries(nestedData.fieldErrors)) {
      if (!result.fieldErrors[key]) {
        if (Array.isArray(val) && val.length > 0) {
          result.fieldErrors[key] = String(val[0])
        } else if (typeof val === 'string') {
          result.fieldErrors[key] = val
        }
      }
    }
  } else if (Array.isArray(nestedData?.errors)) {
    for (const item of nestedData.errors) {
      if (item?.field && item?.message && !result.fieldErrors[item.field]) {
        result.fieldErrors[item.field] = String(item.message)
      }
    }
  }

  return result
}

export function useClubError() {
  return {
    parseClubError
  }
}
