import { resetPasswordSchema, readValidatedBodyStrict } from '../../utils/validation'
import { resetUserPassword, verifyPasswordResetToken } from '../../utils/auth'
import { createClubError } from '../../utils/errors'
import { recordAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  // 1. Zvalidujeme vstupní data (token a nové heslo)
  const input = await readValidatedBodyStrict(event, resetPasswordSchema)

  // Ověříme token pro získání e-mailu pro audit log
  const tokenVerification = await verifyPasswordResetToken(input.token)

  // 2. Bezpečně zahashujeme heslo pomocí hashPassword z nuxt-auth-utils
  const passwordHash = await hashPassword(input.password)

  // 3. Provedeme uložení do DB přes Nitro hook dispatcher
  const success = await resetUserPassword(input.token, passwordHash)

  if (!success) {
    throw createClubError({
      statusCode: 400,
      code: 'INVALID_TOKEN',
      message: 'Neplatný nebo expirovaný token pro obnovu hesla.'
    })
  }

  // 4. Audit log úspěšného resetu hesla
  await recordAuditLog(event, 'password_reset_success', {
    email: tokenVerification.email,
    metadata: { tokenVerified: tokenVerification.valid }
  })

  return {
    success: true,
    message: 'Heslo bylo úspěšně změněno.'
  }
})
