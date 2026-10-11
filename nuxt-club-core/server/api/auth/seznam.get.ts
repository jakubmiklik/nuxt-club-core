import { findOrCreateOAuthUser, getUserMembers } from '../../utils/auth'

export default defineOAuthSeznamEventHandler({
  async onSuccess(event, { user: seznamUser, tokens: _tokens }) {
    // seznamUser obsahuje: { oauth_user_id, email, firstname, lastname, advert_user_id, contact_phone, avatar_url, adulthood, birthday, gender }
    if (!seznamUser.email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Seznam.cz účet neposkytl e-mailovou adresu.'
      })
    }

    const displayName =
      [seznamUser.firstname, seznamUser.lastname].filter(Boolean).join(' ') ||
      seznamUser.email.split('@')[0] ||
      'Uživatel Seznam'

    // 1. Zjistíme nebo vytvoříme uživatele v databázi hostitelské aplikace
    const user = await findOrCreateOAuthUser({
      provider: 'seznam',
      email: seznamUser.email,
      name: displayName,
      avatar: seznamUser.avatar_url || undefined,
      providerId: String(seznamUser.oauth_user_id)
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
        avatar: user.avatar || seznamUser.avatar_url || undefined,
        emailVerified: user.emailVerified ?? true,
        activeMemberId: primaryMember?.id,
        members
      },
      activeMemberId: primaryMember?.id,
      members,
      loggedInAt: Date.now()
    })

    // 4. Zjistíme cílovou redirect adresu (např. z cookie auth_redirect)
    const redirectCookie = getCookie(event, 'auth_redirect')
    const destination = redirectCookie && redirectCookie.startsWith('/') ? redirectCookie : '/'

    // Smažeme dočasnou redirect cookie
    deleteCookie(event, 'auth_redirect')

    return sendRedirect(event, destination)
  },

  onError(event, error) {
    console.error('[nuxt-club-core] Chyba při Seznam OAuth autentizaci:', error)
    deleteCookie(event, 'auth_redirect')
    return sendRedirect(event, '/login?error=seznam_auth_failed')
  }
})
