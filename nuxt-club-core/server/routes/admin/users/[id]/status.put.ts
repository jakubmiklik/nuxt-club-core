import { requireRole, updateAdminUserStatus } from '../../../utils/auth'
import { readValidatedBodyStrict, adminUpdateStatusSchema } from '../../../utils/validation'
import { createClubError } from '../../../utils/errors'
import { recordAuditLog } from '../../../utils/audit'

export interface AdminUpdateStatusResponse {
  success: boolean
  userId: string | number
  status: 'active' | 'suspended'
}

export default defineEventHandler(async (event): Promise<AdminUpdateStatusResponse> => {
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

  const body = await readValidatedBodyStrict(event, adminUpdateStatusSchema)

  // Prevence: Administrátor nemůže sám sebe suspendovat
  if (String(currentUser.id) === String(targetUserId) && body.status === 'suspended') {
    throw createClubError({
      statusCode: 400,
      code: 'FORBIDDEN',
      message: 'Nemůžete zablokovat svůj vlastní administrátorský účet'
    })
  }

  const success = await updateAdminUserStatus(targetUserId, body.status)
  if (!success) {
    throw createClubError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Změna stavu uživatele se nezdařila'
    })
  }

  // Audit log pro změnu stavu
  await recordAuditLog(event, 'status_changed', {
    userId: currentUser.id,
    metadata: {
      targetUserId,
      newStatus: body.status,
      changedBy: currentUser.id
    }
  })

  return {
    success: true,
    userId: targetUserId,
    status: body.status
  }
})
