import { describe, it, expect, vi } from 'vitest'
import { requireRole, requireUser } from '../server/utils/auth'
import type { AppRole, ClubUser } from '../types/auth'
import type { H3Event } from 'h3'

// Mock global getUserSession from nuxt-auth-utils
const mockGetUserSession = vi.fn()
vi.stubGlobal('getUserSession', mockGetUserSession)

// Helper to test client-side hasRole logic (as in useClubAuth)
function checkHasRole(
  user: { role: AppRole } | null,
  loggedIn: boolean,
  roles: AppRole | AppRole[]
): boolean {
  if (!loggedIn || !user) {
    return false
  }

  const currentRole = user.role

  // Admin has automatic superadmin pass
  if (currentRole === 'admin') {
    return true
  }

  if (Array.isArray(roles)) {
    return roles.includes(currentRole)
  }

  return currentRole === roles
}

describe('RBAC Logic & Superadmin Pass', () => {
  const dummyEvent = {} as H3Event

  describe('Server-side requireUser', () => {
    it('throws 401 UNAUTHORIZED when session has no user', async () => {
      mockGetUserSession.mockResolvedValueOnce(null)

      await expect(requireUser(dummyEvent)).rejects.toMatchObject({
        statusCode: 401,
        data: {
          code: 'UNAUTHORIZED',
          statusCode: 401
        }
      })
    })

    it('returns user when session has valid user', async () => {
      const mockUser: ClubUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Jan Novák',
        role: 'user'
      }
      mockGetUserSession.mockResolvedValueOnce({ user: mockUser })

      const result = await requireUser(dummyEvent)
      expect(result).toEqual(mockUser)
    })
  })

  describe('Server-side requireRole', () => {
    it('throws 401 when not logged in', async () => {
      mockGetUserSession.mockResolvedValueOnce(null)

      await expect(requireRole(dummyEvent, 'coach' as AppRole)).rejects.toMatchObject({
        statusCode: 401,
        data: {
          code: 'UNAUTHORIZED'
        }
      })
    })

    it('allows access for admin role regardless of allowedRoles (superadmin pass)', async () => {
      const adminUser: ClubUser = {
        id: 99,
        email: 'admin@club.cz',
        name: 'Hlavní Administrátor',
        role: 'admin'
      }
      mockGetUserSession.mockResolvedValueOnce({ user: adminUser })

      // Required role is coach or referee, but admin passes
      const result = await requireRole(dummyEvent, ['coach' as AppRole, 'referee' as AppRole])
      expect(result).toEqual(adminUser)
    })

    it('allows access when user role is in allowedRoles list', async () => {
      const user: ClubUser = {
        id: 2,
        email: 'user@club.cz',
        name: 'Běžný Uživatel',
        role: 'user'
      }
      mockGetUserSession.mockResolvedValueOnce({ user })

      const result = await requireRole(dummyEvent, ['user', 'coach' as AppRole])
      expect(result).toEqual(user)
    })

    it('allows access when allowedRoles is a single matching role', async () => {
      const user: ClubUser = {
        id: 3,
        email: 'user3@club.cz',
        name: 'Člen',
        role: 'user'
      }
      mockGetUserSession.mockResolvedValueOnce({ user })

      const result = await requireRole(dummyEvent, 'user')
      expect(result).toEqual(user)
    })

    it('throws 403 FORBIDDEN when user role does not match', async () => {
      const user: ClubUser = {
        id: 4,
        email: 'user4@club.cz',
        name: 'Člen',
        role: 'user'
      }
      mockGetUserSession.mockResolvedValueOnce({ user })

      await expect(requireRole(dummyEvent, 'coach' as AppRole)).rejects.toMatchObject({
        statusCode: 403,
        data: {
          code: 'FORBIDDEN'
        }
      })
    })
  })

  describe('Client-side hasRole logic', () => {
    it('returns false when user is not logged in', () => {
      expect(checkHasRole(null, false, 'admin')).toBe(false)
      expect(checkHasRole(null, false, 'user')).toBe(false)
    })

    it('superadmin pass: returns true for admin even if role requested is different', () => {
      const adminUser = { role: 'admin' as AppRole }
      expect(checkHasRole(adminUser, true, 'user')).toBe(true)
      expect(checkHasRole(adminUser, true, ['coach' as AppRole, 'parent' as AppRole])).toBe(true)
      expect(checkHasRole(adminUser, true, 'referee' as AppRole)).toBe(true)
    })

    it('returns true when non-admin has the exact required role', () => {
      const regularUser = { role: 'user' as AppRole }
      expect(checkHasRole(regularUser, true, 'user')).toBe(true)
      expect(checkHasRole(regularUser, true, ['user', 'coach' as AppRole])).toBe(true)
    })

    it('returns false when non-admin does not have required role', () => {
      const regularUser = { role: 'user' as AppRole }
      expect(checkHasRole(regularUser, true, 'coach' as AppRole)).toBe(false)
      expect(checkHasRole(regularUser, true, ['coach' as AppRole, 'parent' as AppRole])).toBe(false)
    })
  })
})
