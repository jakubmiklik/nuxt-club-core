import { acceptInvitationSchema, readValidatedBodyStrict } from '../../utils/validation'
import { getInvitationByToken, acceptMemberInvitation, findUserByEmail, createUser } from '../../utils/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { createClubError } from '../../utils/errors'
import { recordAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  // 1. Rate limiting ochrana
  await checkRateLimit(event, {
    key: 'accept-invite',
    maxAttempts: 5,
    windowSeconds: 60
  })

  // 2. Validace těla požadavku
  const input = await readValidatedBodyStrict(event, acceptInvitationSchema)

  // 3. Ověření existence pozvánky
  const invitation = await getInvitationByToken(input.token)
  if (!invitation) {
    throw createClubError({
      statusCode: 404,
      code: 'INVALID_TOKEN',
      message: 'Pozvánka nebyla nalezena nebo je neplatná.'
    })
  }

  // 4. Kontrola stavu pozvánky (již přijatá / expirovaná)
  if (invitation.acceptedAt) {
    throw createClubError({
      statusCode: 400,
      code: 'INVALID_TOKEN',
      message: 'Tato pozvánka již byla dříve využita.'
    })
  }

  const expiresAt = new Date(invitation.expiresAt)
  if (expiresAt.getTime() < Date.now()) {
    throw createClubError({
      statusCode: 410,
      code: 'TOKEN_EXPIRED',
      message: 'Platnost této pozvánky již vypršela.'
    })
  }

  // 5. Ověříme, zda uživatel s tímto e-mailem už neexistuje
  const existingUser = await findUserByEmail(invitation.email)
  if (existingUser) {
    throw createClubError({
      statusCode: 409,
      code: 'USER_ALREADY_EXISTS',
      message: 'Uživatel s touto e-mailovou adresou již v systému existuje.'
    })
  }

  // 6. Zahashujeme heslo
  const passwordHash = await hashPassword(input.password)

  // 7. Vytvoříme uživatele s rolí z pozvánky (bezpečná, protože ji určil trenér/admin)
  const createdUser = await createUser({
    email: invitation.email,
    name: input.name,
    passwordHash,
    role: invitation.role,
    gdprConsentAt: new Date().toISOString()
  })

  // 8. Označíme pozvánku za přijatou
  await acceptMemberInvitation(input.token, createdUser.id)

  // 9. Připravíme session
  const sessionUser = {
    id: createdUser.id,
    email: createdUser.email,
    name: createdUser.name,
    role: createdUser.role,
    avatar: createdUser.avatar,
    emailVerified: true, // E-mail je z pozvánky ověřený administrátorem
    gdprConsentAt: createdUser.gdprConsentAt,
    termsAcceptedVersion: createdUser.termsAcceptedVersion
  }

  await setUserSession(event, {
    user: sessionUser,
    loggedInAt: Date.now()
  })

  // 10. Auditní záznam
  await recordAuditLog(event, 'invite_accepted', {
    userId: createdUser.id,
    email: createdUser.email,
    metadata: {
      role: createdUser.role,
      token: input.token,
      invitedBy: invitation.invitedBy
    }
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    user: sessionUser
  }
})
