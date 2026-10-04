import { updateProfileSchema, readValidatedBodyStrict } from '../../utils/validation'
import { requireUser, updateUserProfile } from '../../utils/auth'
import { createClubError } from '../../utils/errors'
import { checkRateLimit } from '../../utils/rateLimit'
import { recordAuditLog } from '../../utils/audit'
import type { ClubUser } from '../../../types/auth'

export default defineEventHandler(async (event) => {
  // 1. Vyžaduje přihlášeného uživatele
  const currentUser = await requireUser(event)

  // 2. Rate limiting (10 aktualizací za minutu)
  await checkRateLimit(event, {
    key: `profile-update:${currentUser.id}`,
    maxAttempts: 10,
    windowSeconds: 60
  })

  // 3. Validace těla požadavku
  const input = await readValidatedBodyStrict(event, updateProfileSchema)

  // 4. Aktualizace profilu v DB přes Nitro hook auth:update-user-profile
  const updatedUser = await updateUserProfile({
    userId: currentUser.id,
    name: input.name,
    avatar: input.avatar ? input.avatar : undefined
  })

  if (!updatedUser) {
    throw createClubError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Profil se nepodařilo aktualizovat. Zkontrolujte, zda hostitelská aplikace zaregistrovala hook "auth:update-user-profile".'
    })
  }

  // 5. Obnova šifrované session v cookies přes nuxt-auth-utils
  const currentSession = await getUserSession(event)
  const sessionUser: ClubUser = {
    ...currentSession.user,
    ...updatedUser,
    name: updatedUser.name,
    avatar: updatedUser.avatar || undefined
  }

  await setUserSession(event, {
    ...currentSession,
    user: sessionUser
  })

  // 6. Audit log
  await recordAuditLog(event, 'profile_updated', {
    userId: currentUser.id,
    email: currentUser.email,
    metadata: {
      name: updatedUser.name,
      hasAvatar: !!updatedUser.avatar
    }
  })

  return {
    success: true,
    user: sessionUser
  }
})
