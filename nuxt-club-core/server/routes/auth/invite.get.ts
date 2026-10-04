import { getInvitationByToken } from '../../utils/auth'
import { createClubError } from '../../utils/errors'
import type { AppRole } from '../../../types/auth'

export interface InviteDetailsResponse {
  valid: boolean
  email: string
  role: AppRole
  category?: string
  expiresAt: string | Date
}

export default defineEventHandler(async (event): Promise<InviteDetailsResponse> => {
  const query = getQuery(event)
  const token = query.token ? String(query.token).trim() : ''

  if (!token) {
    throw createClubError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Token pozvánky je povinný.'
    })
  }

  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    throw createClubError({
      statusCode: 404,
      code: 'INVALID_TOKEN',
      message: 'Pozvánka nebyla nalezena nebo je neplatná.'
    })
  }

  // Kontrola, zda již nebyla pozvánka přijata
  if (invitation.acceptedAt) {
    throw createClubError({
      statusCode: 400,
      code: 'INVALID_TOKEN',
      message: 'Tato pozvánka již byla dříve využita.'
    })
  }

  // Kontrola expirace
  const expiresAt = new Date(invitation.expiresAt)
  if (expiresAt.getTime() < Date.now()) {
    throw createClubError({
      statusCode: 410,
      code: 'TOKEN_EXPIRED',
      message: 'Platnost této pozvánky již vypršela. Požádejte administrátora nebo trenéra o nové zaslání.'
    })
  }

  return {
    valid: true,
    email: invitation.email,
    role: invitation.role,
    category: invitation.category,
    expiresAt: invitation.expiresAt
  }
})
