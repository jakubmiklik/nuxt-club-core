import { loginSchema, readValidatedBodyStrict } from '../../utils/validation'
import { findUserByEmail } from '../../utils/auth'
import { verifyUserPassword } from '../../utils/password'

export default defineEventHandler(async (event) => {
  // 1. Zvalidujeme vstupní data
  const { email, password } = await readValidatedBodyStrict(event, loginSchema)

  // 2. Vyhledáme uživatele v databázi hostitelské aplikace přes hook
  const user = await findUserByEmail(email)

  // 3. Zkontrolujeme existenci uživatele a přítomnost hashe hesla
  if (!user || !user.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Neplatný e-mail nebo heslo.'
    })
  }

  // 4. Ověříme heslo proti uloženému hashi
  const isPasswordValid = await verifyUserPassword(user.passwordHash, password)
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Neplatný e-mail nebo heslo.'
    })
  }

  // 5. Vytvoříme bezpečný objekt uživatele pro session (bez citlivých údajů jako passwordHash)
  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar
  }

  // 6. Nastavíme šifrovanou HTTP-only cookie session
  await setUserSession(event, {
    user: sessionUser,
    loggedInAt: Date.now()
  })

  return {
    success: true,
    user: sessionUser
  }
})
