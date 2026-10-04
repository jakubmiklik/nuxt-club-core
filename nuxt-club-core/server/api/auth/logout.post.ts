import { recordAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  // Zjistíme uživatele před promazáním relace pro auditní záznam
  const session = await getUserSession(event)
  const user = session?.user

  // Vymaže šifrovanou cookie session
  await clearUserSession(event)

  if (user) {
    await recordAuditLog(event, 'logout', {
      userId: user.id,
      email: user.email
    })
  }

  return {
    success: true,
    message: 'Odhlášení proběhlo úspěšně.'
  }
})
