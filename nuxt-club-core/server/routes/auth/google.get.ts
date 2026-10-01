import { findOrCreateOAuthUser } from '../../utils/auth'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user: googleUser, tokens }) {
    // googleUser obsahuje: { sub, name, given_name, family_name, picture, email, email_verified }
    if (!googleUser.email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Google účet neposkytl e-mailovou adresu.'
      })
    }

    // 1. Zjistíme nebo vytvoříme uživatele v databázi hostitelské aplikace
    const user = await findOrCreateOAuthUser({
      provider: 'google',
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      avatar: googleUser.picture,
      providerId: googleUser.sub
    })

    // 2. Nastavíme šifrovanou uživatelskou session
    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'member',
        avatar: user.avatar || googleUser.picture
      },
      loggedInAt: Date.now()
    })

    // 3. Zjistíme, kam má být uživatel přesměrován (např. z cookie auth_redirect)
    const redirectCookie = getCookie(event, 'auth_redirect')
    const destination = redirectCookie && redirectCookie.startsWith('/') ? redirectCookie : '/'

    // Smažeme dočasnou redirect cookie
    deleteCookie(event, 'auth_redirect')

    return sendRedirect(event, destination)
  },

  onError(event, error) {
    console.error('[nuxt-club-core] Chyba při Google OAuth autentizaci:', error)
    return sendRedirect(event, '/login?error=google_auth_failed')
  }
})
