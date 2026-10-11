import { findOrCreateOAuthUser, getUserMembers } from '../../utils/auth'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user: googleUser, tokens: _tokens }) {
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

    if (!user) {
      deleteCookie(event, 'auth_redirect')
      return sendRedirect(event, '/login?error=account_not_allowed')
    }

    // 2. Načteme profily členů a určíme výchozí aktivní profil
    const members = await getUserMembers(user.id)
    const primaryMember = members.find((m) => m.isPrimary) || members[0]

    // 3. Nastavíme šifrovanou uživatelskou session
    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        avatar: user.avatar || googleUser.picture,
        emailVerified: user.emailVerified ?? true,
        activeMemberId: primaryMember?.id,
        members
      },
      activeMemberId: primaryMember?.id,
      members,
      loggedInAt: Date.now()
    })

    // 4. Zjistíme, kam má být uživatel přesměrován (např. z cookie auth_redirect)
    const redirectCookie = getCookie(event, 'auth_redirect')
    const destination = redirectCookie && redirectCookie.startsWith('/') ? redirectCookie : '/'

    // Smažeme dočasnou redirect cookie
    deleteCookie(event, 'auth_redirect')

    return sendRedirect(event, destination)
  },

  onError(event, error) {
    console.error('[nuxt-club-core] Chyba při Google OAuth autentizaci:', error)
    deleteCookie(event, 'auth_redirect')
    return sendRedirect(event, '/login?error=google_auth_failed')
  }
})
