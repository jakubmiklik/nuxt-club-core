import { requireRole, updateAdminUserRole } from '../../../../utils/auth'
import { readValidatedBodyStrict, adminUpdateRoleSchema } from '../../../../utils/validation'
import { createClubError } from '../../../../utils/errors'
import { recordAuditLog } from '../../../../utils/audit'
import type { AppRole } from '../../../../../types/auth'

export interface AdminUpdateRoleResponse {
  success: boolean
  userId: string | number
  newRole: AppRole
}

export default defineEventHandler(async (event): Promise<AdminUpdateRoleResponse> => {
  // Pouze administrátoři mají přístup
  const currentUser = await requireRole(event, ['admin'])

  const targetUserId = getRouterParam(event, 'id')
  if (!targetUserId) {
    throw createClubError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'ID uživatele je povinné'
    })
  }

  // Prevence: Administrátor nemůže sám sobě odebrat roli admin (aby neztratil přístup)
  const body = await readValidatedBodyStrict(event, adminUpdateRoleSchema)
  const newRole = body.role as AppRole

  if (String(currentUser.id) === String(targetUserId) && newRole !== 'admin') {
    throw createClubError({
      statusCode: 400,
      code: 'FORBIDDEN',
      message: 'Nemůžete odebrat roli administrátora svému vlastnímu účtu'
    })
  }

  const success = await updateAdminUserRole(targetUserId, newRole)
  if (!success) {
    throw createClubError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Změna role uživatele se nezdařila'
    })
  }

  // Audit log pro změnu role
  await recordAuditLog(event, 'role_changed', {
    userId: currentUser.id,
    metadata: {
      targetUserId,
      newRole,
      changedBy: currentUser.id
    }
  })

  return {
    success: true,
    userId: targetUserId,
    newRole
  }
})
