import { verifyEmailSchema, readValidatedBodyStrict } from '../../utils/validation'
import { verifyEmailToken, findUserById } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  // 1. Zvalidujeme vstupní data (token)
  const input = await readValidatedBodyStrict(event, verifyEmailSchema)

  // 2. Ověříme token přes Nitro hook dispatcher
  const verifyResult = await verifyEmailToken(input.token)

  if (!verifyResult.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Neplatný nebo expirovaný token pro ověření e-mailu.'
    })
  }

  // 3. Aktualizujeme session, pokud je uživatel přihlášen
  const session = await getUserSession(event)
  if (session?.user) {
    // Pokud je ověřován stejný uživatel nebo nebyl v hooku vrácen konkrétní userId
    if (!verifyResult.userId || String(verifyResult.userId) === String(session.user.id)) {
      await setUserSession(event, {
        ...session,
        user: {
          ...session.user,
          emailVerified: true
        }
      })
    }
  } else if (verifyResult.userId) {
    // Pokud uživatel nebyl přihlášen, ale hook vrátil userId, pokusíme se ho dohledat a případně připravit
    const user = await findUserById(verifyResult.userId)
    if (user) {
      // Uživatel může být přihlášen nebo přesměrován na login s potvrzenou adresou
    }
  }

  return {
    success: true,
    message: 'E-mailová adresa byla úspěšně ověřena.'
  }
})
