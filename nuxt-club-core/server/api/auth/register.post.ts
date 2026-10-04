import { registerSchema, readValidatedBodyStrict, FORBIDDEN_REGISTRATION_ROLES } from '../../utils/validation'
import { findUserByEmail, createUser } from '../../utils/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { createClubError } from '../../utils/errors'
import { recordAuditLog } from '../../utils/audit'
import type { AppRole } from '../../../types/auth'

export default defineEventHandler(async (event) => {
  // 0. Rate limiting ochrana proti hromadné registraci / zneužití (3 pokusy / 60s)
  await checkRateLimit(event, {
    key: 'register',
    maxAttempts: 3,
    windowSeconds: 60
  })

  // 1. Zvalidujeme data registračního formuláře
  const input = await readValidatedBodyStrict(event, registerSchema)

  // 2. Ověříme, zda uživatel s tímto e-mailem již neexistuje
  const existingUser = await findUserByEmail(input.email)
  if (existingUser) {
    throw createClubError({
      statusCode: 409,
      code: 'USER_ALREADY_EXISTS',
      message: 'Uživatel s touto e-mailovou adresou již existuje.'
    })
  }

  // 3. Bezpečně zahashujeme heslo pomocí hashPassword z nuxt-auth-utils
  const passwordHash = await hashPassword(input.password)

  // 4. Bezpečnostní kontrola role (ochrana proti Privilege Escalation)
  // Administrátorská role nesmí být nikdy vytvořena přes veřejnou registraci
  const normalizedRole = input.role ? input.role.trim().toLowerCase() : 'user'
  if (FORBIDDEN_REGISTRATION_ROLES.includes(normalizedRole as (typeof FORBIDDEN_REGISTRATION_ROLES)[number])) {
    throw createClubError({
      statusCode: 400,
      code: 'FORBIDDEN',
      message: 'Administrátorská role nemůže být přiřazena při veřejné registraci.'
    })
  }

  const roleToAssign: AppRole = (normalizedRole as AppRole) || 'user'

  // 5. Předáme vytvoření uživatele databázovému hooku hostitelské aplikace
  const createdUser = await createUser({
    email: input.email,
    name: input.name,
    passwordHash,
    role: roleToAssign,
    gdprConsentAt: new Date().toISOString()
  })

  // 6. Připravíme data pro session
  const sessionUser = {
    id: createdUser.id,
    email: createdUser.email,
    name: createdUser.name,
    role: createdUser.role,
    avatar: createdUser.avatar,
    emailVerified: createdUser.emailVerified ?? false,
    gdprConsentAt: createdUser.gdprConsentAt,
    termsAcceptedVersion: createdUser.termsAcceptedVersion
  }

  // 7. Uživatel je po úspěšné registraci automaticky přihlášen
  await setUserSession(event, {
    user: sessionUser,
    loggedInAt: Date.now()
  })

  // 8. Audit log registrace nového uživatele
  await recordAuditLog(event, 'register', {
    userId: createdUser.id,
    email: createdUser.email,
    metadata: { role: createdUser.role }
  })

  // Vrátíme 201 Created
  setResponseStatus(event, 201)

  return {
    success: true,
    user: sessionUser
  }
})
