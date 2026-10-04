import { loginSchema, readValidatedBodyStrict } from '../../utils/validation'
import { findUserByEmail, getUserMembers } from '../../utils/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { createClubError } from '../../utils/errors'
import { recordAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  // 0. Rate limiting ochrana proti brute-force útokům (5 pokusů / 60s)
  await checkRateLimit(event, {
    key: 'login',
    maxAttempts: 5,
    windowSeconds: 60
  })

  // 1. Zvalidujeme vstupní data
  const { email, password } = await readValidatedBodyStrict(event, loginSchema)

  // 2. Vyhledáme uživatele v databázi hostitelské aplikace přes hook
  const user = await findUserByEmail(email)

  // 3. Zkontrolujeme existenci uživatele a přítomnost hashe hesla
  if (!user || !user.passwordHash) {
    await recordAuditLog(event, 'login_failed', {
      email,
      metadata: { reason: 'user_not_found_or_no_password' }
    })

    throw createClubError({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Neplatný e-mail nebo heslo.'
    })
  }

  // 4. Ověříme heslo proti uloženému hashi pomocí verifyPassword z nuxt-auth-utils
  const isPasswordValid = await verifyPassword(user.passwordHash, password)
  if (!isPasswordValid) {
    await recordAuditLog(event, 'login_failed', {
      userId: user.id,
      email,
      metadata: { reason: 'invalid_password' }
    })

    throw createClubError({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Neplatný e-mail nebo heslo.'
    })
  }

  // 5. Získáme profily členů uživatele a určíme primární/výchozí aktivní profil
  const members = await getUserMembers(user.id)
  const primaryMember = members.find((m) => m.isPrimary) || members[0]

  // 6. Vytvoříme bezpečný objekt uživatele pro session (bez citlivých údajů jako passwordHash)
  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    emailVerified: user.emailVerified,
    activeMemberId: primaryMember?.id,
    members
  }

  // 7. Nastavíme šifrovanou HTTP-only cookie session
  await setUserSession(event, {
    user: sessionUser,
    activeMemberId: primaryMember?.id,
    members,
    loggedInAt: Date.now()
  })

  // 8. Zaznamenáme úspěšné přihlášení do audit logu
  await recordAuditLog(event, 'login_success', {
    userId: user.id,
    email: user.email
  })

  return {
    success: true,
    user: sessionUser
  }
})
