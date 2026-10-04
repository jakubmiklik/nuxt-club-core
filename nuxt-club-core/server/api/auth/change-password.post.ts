import { changePasswordSchema, readValidatedBodyStrict } from '../../utils/validation'
import { requireUser, findUserById, updateUserPassword } from '../../utils/auth'
import { createClubError } from '../../utils/errors'
import { checkRateLimit } from '../../utils/rateLimit'
import { recordAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  // 1. Vyžaduje přihlášeného uživatele
  const currentUser = await requireUser(event)

  // 2. Rate limiting ochrana proti brute-force útokům na heslo (5 pokusů / 60s)
  await checkRateLimit(event, {
    key: `change-password:${currentUser.id}`,
    maxAttempts: 5,
    windowSeconds: 60
  })

  // 3. Validace vstupních dat
  const input = await readValidatedBodyStrict(event, changePasswordSchema)

  // 4. Ověření stávajícího hesla uživatele z DB (přes hook auth:find-user-by-id)
  const dbUser = await findUserById(currentUser.id)
  if (!dbUser || !dbUser.passwordHash) {
    throw createClubError({
      statusCode: 400,
      code: 'INVALID_CREDENTIALS',
      message: 'Uživatelský účet nemá nastavené heslo nebo nebyl nalezen.'
    })
  }

  const isCurrentPasswordValid = await verifyPassword(dbUser.passwordHash, input.currentPassword)
  if (!isCurrentPasswordValid) {
    throw createClubError({
      statusCode: 400,
      code: 'INVALID_CREDENTIALS',
      message: 'Současné heslo není správné.',
      fieldErrors: {
        currentPassword: ['Současné heslo není správné']
      }
    })
  }

  // 5. Zahashování nového hesla
  const newPasswordHash = await hashPassword(input.newPassword)

  // 6. Uložení nového hesla přes hook auth:update-user-password
  const success = await updateUserPassword(currentUser.id, newPasswordHash)
  if (!success) {
    throw createClubError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Heslo se nepodařilo aktualizovat. Zkontrolujte, zda hostitelská aplikace zaregistrovala hook "auth:update-user-password".'
    })
  }

  // 7. Záznam do auditního logu
  await recordAuditLog(event, 'password_changed', {
    userId: currentUser.id,
    email: currentUser.email
  })

  return {
    success: true,
    message: 'Heslo bylo úspěšně změněno.'
  }
})
