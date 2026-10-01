import { registerSchema, readValidatedBodyStrict } from '../../utils/validation'
import { findUserByEmail, createUser } from '../../utils/auth'
import type { AppRole } from '../../../types/auth'

export default defineEventHandler(async (event) => {
  // 1. Zvalidujeme data registračního formuláře
  const input = await readValidatedBodyStrict(event, registerSchema)

  // 2. Ověříme, zda uživatel s tímto e-mailem již neexistuje
  const existingUser = await findUserByEmail(input.email)
  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: 'Uživatel s touto e-mailovou adresou již existuje.'
    })
  }

  // 3. Bezpečně zahashujeme heslo pomocí hashPassword z nuxt-auth-utils
  const passwordHash = await hashPassword(input.password)

  // 4. Předáme vytvoření uživatele databázovému hooku hostitelské aplikace
  const createdUser = await createUser({
    email: input.email,
    name: input.name,
    passwordHash,
    role: (input.role as AppRole) || 'user'
  })

  // 5. Připravíme data pro session
  const sessionUser = {
    id: createdUser.id,
    email: createdUser.email,
    name: createdUser.name,
    role: createdUser.role,
    avatar: createdUser.avatar
  }

  // 6. Uživatel je po úspěšné registraci automaticky přihlášen
  await setUserSession(event, {
    user: sessionUser,
    loggedInAt: Date.now()
  })

  // Vrátíme 201 Created
  setResponseStatus(event, 201)

  return {
    success: true,
    user: sessionUser
  }
})
