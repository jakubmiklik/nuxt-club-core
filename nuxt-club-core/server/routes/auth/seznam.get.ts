import { eventHandler, getQuery, sendRedirect, createError, getCookie, deleteCookie } from 'h3'
import { withQuery } from 'ufo'
import { defu } from 'defu'
import {
  handleMissingConfiguration,
  handleAccessTokenErrorResponse,
  getOAuthRedirectURL,
  handleInvalidState,
  handleState,
  requestAccessToken
} from 'nuxt-auth-utils/dist/runtime/server/lib/utils'
import { findOrCreateOAuthUser, getUserMembers } from '../../utils/auth'

export interface OAuthSeznamConfig {
  clientId?: string
  clientSecret?: string
  redirectURL?: string
  authorizationURL?: string
  tokenURL?: string
  userURL?: string
  scope?: string[]
}

export interface SeznamUser {
  oauth_user_id: string
  email?: string
  firstname?: string
  lastname?: string
  avatar_url?: string
  contact_phone?: string
  adulthood?: boolean
  [key: string]: any
}

export default eventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const config = defu(
    (runtimeConfig.oauth as any)?.seznam,
    {
      clientId: process.env.NUXT_OAUTH_SEZNAM_CLIENT_ID,
      clientSecret: process.env.NUXT_OAUTH_SEZNAM_CLIENT_SECRET,
      authorizationURL: 'https://login.szn.cz/api/v1/oauth/auth',
      tokenURL: 'https://login.szn.cz/api/v1/oauth/token',
      userURL: 'https://login.szn.cz/api/v1/user',
      scope: ['identity', 'avatar']
    }
  )

  const query = getQuery(event)

  if (query.error) {
    console.error('[nuxt-club-core] Chyba při Seznam OAuth autentizaci:', query.error)
    return sendRedirect(event, '/login?error=seznam_auth_failed')
  }

  if (!config.clientId || !config.clientSecret) {
    return handleMissingConfiguration(event, 'seznam' as any, ['clientId', 'clientSecret'])
  }

  const redirectURL = config.redirectURL || getOAuthRedirectURL(event)
  const state = await handleState(event)

  // 1. Zahájení OAuth redirectu na Seznam.cz authorization endpoint
  if (!query.code) {
    return sendRedirect(
      event,
      withQuery(config.authorizationURL, {
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectURL,
        scope: (config.scope || ['identity', 'avatar']).join(' '),
        state
      })
    )
  }

  // 2. Kontrola stavu proti CSRF útoku
  if (query.state !== state) {
    return handleInvalidState(event, 'seznam' as any)
  }

  // 3. Výměna authorization code za přístupový token na token endpointu
  const tokens = await requestAccessToken(config.tokenURL, {
    body: {
      grant_type: 'authorization_code',
      code: query.code as string,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectURL
    }
  })

  if (tokens.error) {
    return handleAccessTokenErrorResponse(event, 'seznam' as any, tokens)
  }

  const accessToken = tokens.access_token

  // 4. Získání informací o uživateli z userinfo endpointu
  const seznamUser = await $fetch<SeznamUser>(config.userURL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!seznamUser.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Seznam.cz účet neposkytl e-mailovou adresu.'
    })
  }

  const displayName =
    [seznamUser.firstname, seznamUser.lastname].filter(Boolean).join(' ') ||
    seznamUser.email.split('@')[0]

  // 5. Zjistíme nebo vytvoříme uživatele v databázi hostitelské aplikace
  const user = await findOrCreateOAuthUser({
    provider: 'seznam',
    email: seznamUser.email,
    name: displayName,
    avatar: seznamUser.avatar_url,
    providerId: String(seznamUser.oauth_user_id)
  })

  // 6. Načteme profily členů a určíme výchozí aktivní profil
  const members = await getUserMembers(user.id)
  const primaryMember = members.find((m) => m.isPrimary) || members[0]

  // 7. Nastavíme šifrovanou uživatelskou session
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      avatar: user.avatar || seznamUser.avatar_url,
      emailVerified: user.emailVerified ?? true,
      activeMemberId: primaryMember?.id,
      members
    },
    activeMemberId: primaryMember?.id,
    members,
    loggedInAt: Date.now()
  })

  // 8. Zjistíme cílovou redirect adresu (např. z cookie auth_redirect)
  const redirectCookie = getCookie(event, 'auth_redirect')
  const destination = redirectCookie && redirectCookie.startsWith('/') ? redirectCookie : '/'

  // Smažeme dočasnou redirect cookie
  deleteCookie(event, 'auth_redirect')

  return sendRedirect(event, destination)
})
