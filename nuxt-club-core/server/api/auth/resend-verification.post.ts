import { requireUser, resendVerificationEmail, sendVerificationEmail } from '../../utils/auth'
import { checkRateLimit } from '../../utils/rateLimit'
import { getRequestURL } from 'h3'

export default defineEventHandler(async (event) => {
  // 1. Ověříme, zda je uživatel přihlášen
  const user = await requireUser(event)

  // 2. Pokud už má uživatel e-mail ověřený, není třeba jej znovu odesílat
  if (user.emailVerified) {
    return {
      success: true,
      message: 'Váš e-mail je již ověřen.'
    }
  }

  // 3. Rate limiting ochrana proti floodování a zneužití (max 3 pokusy za 300 sekund na uživatele a IP)
  await checkRateLimit(event, {
    key: `resend-verification:${user.id}`,
    maxAttempts: 3,
    windowSeconds: 300
  })

  // 4. Nejprve zkusíme hook 'auth:resend-verification-email'
  const resendResult = await resendVerificationEmail(user.id)

  // Pokud hook odeslal e-mail, vrátíme úspěch
  if (resendResult.sent) {
    return {
      success: true,
      message: 'Ověřovací e-mail byl úspěšně odeslán.'
    }
  }

  // 5. Fallback: Pokud hostitelská aplikace neimplementuje specifický resend hook nebo vrátil false,
  // použijeme obecný dispatcher sendVerificationEmail
  let baseUrl: string | undefined
  try {
    baseUrl = getRequestURL(event).origin
  } catch {
    // Fallback
  }

  const sendResult = await sendVerificationEmail(user.id, user.email, baseUrl)

  return {
    success: true,
    sent: sendResult.sent,
    message: 'Ověřovací e-mail byl úspěšně odeslán.'
  }
})
