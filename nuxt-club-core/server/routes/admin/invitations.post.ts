import { requireRole, createMemberInvitation, findUserByEmail } from '../../utils/auth'
import { readValidatedBodyStrict, createInvitationSchema } from '../../utils/validation'
import { recordAuditLog } from '../../utils/audit'
import { createClubError } from '../../utils/errors'
import type { AppRole } from '../../../types/auth'

export default defineEventHandler(async (event) => {
  // 1. Chráněno: přístup mají pouze role admin a coach
  const currentUser = await requireRole(event, ['admin', 'coach'])

  // 2. Validace vstupních parametrů
  const input = await readValidatedBodyStrict(event, createInvitationSchema)

  // 3. Kontrola, zda uživatel s tímto e-mailem již neexistuje
  const existingUser = await findUserByEmail(input.email)
  if (existingUser) {
    throw createClubError({
      statusCode: 409,
      code: 'USER_ALREADY_EXISTS',
      message: 'Uživatel s touto e-mailovou adresou již v systému existuje.'
    })
  }

  // 4. Základní URL pro odkaz v e-mailu
  const reqUrl = getRequestURL(event)
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`

  // 5. Vytvoření pozvánky a odeslání e-mailu
  const { invitation, inviteUrl, emailSent } = await createMemberInvitation({
    email: input.email,
    role: input.role as AppRole,
    invitedBy: currentUser.id,
    category: input.category,
    baseUrl
  })

  // 6. Auditní log
  await recordAuditLog(event, 'invite_sent', {
    userId: currentUser.id,
    email: input.email,
    metadata: {
      role: input.role,
      category: input.category,
      invitationId: invitation.id,
      emailSent
    }
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    invitation,
    inviteUrl,
    emailSent
  }
})
