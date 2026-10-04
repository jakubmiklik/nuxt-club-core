import { getRequestURL } from 'h3'
import { forgotPasswordSchema, readValidatedBodyStrict } from '../../utils/validation'
import { findUserByEmail, requestPasswordReset } from '../../utils/auth'
import { checkRateLimit } from '../../utils/rateLimit'

import { recordAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  // 0. Rate limiting ochrana proti floodování e-mailů a brute-force (3 pokusy / 300s)
  await checkRateLimit(event, {
    key: 'forgot-password',
    maxAttempts: 3,
    windowSeconds: 300
  })

  // 1. Zvalidujeme e-mail ze vstupních dat
  const { email } = await readValidatedBodyStrict(event, forgotPasswordSchema)

  // Obecná odpověď chránící proti odhalení existence e-mailu (Email Enumeration Protection)
  const genericMessage = 'Pokud tento e-mail existuje, byly na něj zaslány instrukce pro obnovu hesla.'

  // 2. Ověříme, zda uživatel s tímto e-mailem v systému existuje
  const existingUser = await findUserByEmail(email)
  if (!existingUser) {
    return {
      success: true,
      message: genericMessage
    }
  }

  // 3. Zjistíme základní URL aplikace pro sestavení odkazu pro obnovu hesla
  let baseUrl: string | undefined
  try {
    baseUrl = getRequestURL(event).origin
  } catch {
    // Fallback pro nestandardní nebo testovací prostředí
  }

  // 4. Zavoláme dispatcher, který spustí hooky pro vytvoření tokenu a odeslání e-mailu
  await requestPasswordReset(email, baseUrl)

  // 5. Audit log žádosti o obnovu hesla
  await recordAuditLog(event, 'password_reset_request', {
    userId: existingUser.id,
    email: existingUser.email
  })

  return {
    success: true,
    message: genericMessage
  }
})
