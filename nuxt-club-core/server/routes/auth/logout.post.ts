export default defineEventHandler(async (event) => {
  // Vymaže šifrovanou cookie session
  await clearUserSession(event)

  return {
    success: true,
    message: 'Odhlášení proběhlo úspěšně.'
  }
})
