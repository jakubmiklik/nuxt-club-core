import { requireRole, listAdminUsers } from '../../utils/auth'
import type { ClubUser, AppRole } from '../../../types/auth'

export interface AdminListUsersResponse {
  users: ClubUser[]
  total: number
  page: number
  limit: number
}

export default defineEventHandler(async (event): Promise<AdminListUsersResponse> => {
  // Pouze administrátoři mají přístup
  await requireRole(event, ['admin'])

  const query = getQuery(event)

  const page = query.page ? Math.max(1, parseInt(String(query.page), 10) || 1) : 1
  const limit = query.limit ? Math.min(100, Math.max(1, parseInt(String(query.limit), 10) || 20)) : 20
  const search = query.search ? String(query.search).trim() : undefined
  const role = query.role ? (String(query.role).trim() as AppRole) : undefined

  const result = await listAdminUsers({
    page,
    limit,
    search,
    role
  })

  return {
    users: result.users || [],
    total: result.total ?? (result.users?.length || 0),
    page,
    limit
  }
})
