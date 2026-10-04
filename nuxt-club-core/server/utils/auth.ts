import type { H3Event } from 'h3'
import type { AppRole, ClubUser, AuthDatabaseUser, ClubMemberProfile, ClubSeason, ClubBranch, ClubInvitation } from '../../types/auth'
import { createClubError } from './errors'

/**
 * Získá aktuálně přihlášeného uživatele ze šifrované session.
 * Pokud uživatel není přihlášen, vyvolá HTTP 401 Unauthorized.
 */
export async function requireUser(event: H3Event): Promise<ClubUser> {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createClubError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Pro přístup k této akci musíte být přihlášeni.'
    })
  }

  return session.user as ClubUser
}

/**
 * Ověří, zda má přihlášený uživatel jednu z povolených rolí (RBAC).
 * Pravidla:
 * 1. Pokud uživatel není přihlášen, vyvolá 401 Unauthorized.
 * 2. Pokud má uživatel roli 'admin', má přístup automaticky povolen (superadmin pass).
 * 3. Pokud role neodpovídá povoleným rolím, vyvolá 403 Forbidden.
 *
 * @param event H3Event requestu
 * @param allowedRoles Jedna nebo více rolí (AppRole)
 */
export async function requireRole(
  event: H3Event,
  allowedRoles: AppRole | AppRole[]
): Promise<ClubUser> {
  const user = await requireUser(event)

  // Uživatel s rolí admin má automaticky přístup ke všem chráněným zdrojům
  if (user.role === 'admin') {
    return user
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  if (!roles.includes(user.role)) {
    throw createClubError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: `Nedostatečná oprávnění. Vyžadována role: ${roles.join(' nebo ')}, vaše role: ${String(user.role)}.`
    })
  }

  return user
}

// ==========================================
// Nitro Hooks Dispatchers (Oddělení od DB)
// ==========================================

/**
 * Vyhledá uživatele podle e-mailu pomocí Nitro Hooku 'auth:find-user-by-email'.
 * Hook implementuje hostitelská aplikace (např. přes Drizzle ORM).
 */
export async function findUserByEmail(email: string): Promise<AuthDatabaseUser | null> {
  const nitroApp = useNitroApp()
  const result: { user: AuthDatabaseUser | null } = { user: null }

  await nitroApp.hooks.callHook('auth:find-user-by-email', { email }, result)
  return result.user
}

/**
 * Vyhledá uživatele podle ID pomocí Nitro Hooku 'auth:find-user-by-id'.
 */
export async function findUserById(id: string | number): Promise<AuthDatabaseUser | null> {
  const nitroApp = useNitroApp()
  const result: { user: AuthDatabaseUser | null } = { user: null }

  await nitroApp.hooks.callHook('auth:find-user-by-id', { id }, result)
  return result.user
}

/**
 * Vytvoří nového uživatele v hostitelské DB pomocí Nitro Hooku 'auth:create-user'.
 */
export async function createUser(data: {
  email: string
  name: string
  passwordHash: string
  role?: AppRole
  gdprConsentAt?: string | Date
  termsAcceptedVersion?: string
}): Promise<ClubUser> {
  const nitroApp = useNitroApp()
  const result: { user: ClubUser | null } = { user: null }

  await nitroApp.hooks.callHook('auth:create-user', {
    ...data,
    role: data.role || 'user'
  }, result)

  if (!result.user) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Uživatele se nepodařilo vytvořit. Zkontrolujte, zda hostitelská aplikace zaregistrovala Nitro hook "auth:create-user".'
    })
  }

  return result.user
}

/**
 * Vyhledá nebo založí uživatele při přihlášení přes OAuth (Google nebo Seznam).
 */
export async function findOrCreateOAuthUser(data: {
  provider: 'google' | 'seznam'
  email: string
  name: string
  avatar?: string
  providerId?: string
}): Promise<ClubUser> {
  const nitroApp = useNitroApp()
  const result: { user: ClubUser | null } = { user: null }

  await nitroApp.hooks.callHook('auth:find-or-create-oauth-user', data, result)

  if (result.user) {
    return result.user
  }

  // Fallback: Pokud hostitelská aplikace nemá specifický OAuth hook,
  // zkusíme najít uživatele podle e-mailu:
  const existingUser = await findUserByEmail(data.email)
  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role,
      avatar: existingUser.avatar || data.avatar
    }
  }

  // Pokud neexistuje, zkusíme vytvořit uživatele s náhodným heslem a výchozí rolí 'user'
  const randomPasswordHash = await hashUserPassword(crypto.randomUUID())
  return await createUser({
    email: data.email,
    name: data.name,
    passwordHash: randomPasswordHash,
    role: 'user'
  })
}

/**
 * Export aliasu pro OAuth Google event handler odpovídající specifikaci
 */
export const oauthGoogleEventHandler = typeof defineOAuthGoogleEventHandler !== 'undefined'
  ? defineOAuthGoogleEventHandler
  : undefined

/**
 * Vyžádá obnovu hesla pro zadaný e-mail.
 * Spustí Nitro hook 'auth:generate-password-reset-token' pro vytvoření tokenu
 * a následně 'auth:send-password-reset-email' pro odeslání e-mailu uživateli.
 */
export async function requestPasswordReset(
  email: string,
  baseUrl?: string
): Promise<{ success: boolean; token: string | null; sent: boolean }> {
  const nitroApp = useNitroApp()
  const tokenResult: { token: string | null; resetUrl?: string } = { token: null }

  await nitroApp.hooks.callHook('auth:generate-password-reset-token', { email }, tokenResult)

  const token = tokenResult.token
  if (!token) {
    return { success: false, token: null, sent: false }
  }

  const cleanBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : ''
  const resetUrl =
    tokenResult.resetUrl ||
    (cleanBaseUrl
      ? `${cleanBaseUrl}/reset-password?token=${encodeURIComponent(token)}`
      : `/reset-password?token=${encodeURIComponent(token)}`)

  const sendResult: { sent: boolean } = { sent: false }
  await nitroApp.hooks.callHook(
    'auth:send-password-reset-email',
    {
      email,
      token,
      resetUrl
    },
    sendResult
  )

  return {
    success: true,
    token,
    sent: sendResult.sent
  }
}

/**
 * Ověří platnost tokenu pro obnovu hesla pomocí Nitro hooku 'auth:verify-password-reset-token'.
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ valid: boolean; email?: string }> {
  const nitroApp = useNitroApp()
  const result: { valid: boolean; email?: string } = { valid: false }

  await nitroApp.hooks.callHook('auth:verify-password-reset-token', { token }, result)

  return result
}

/**
 * Provede reset hesla v databázi hostitelské aplikace pomocí Nitro hooku 'auth:reset-password'.
 */
export async function resetUserPassword(
  token: string,
  newPasswordHash: string
): Promise<boolean> {
  const nitroApp = useNitroApp()
  const result: { success: boolean } = { success: false }

  await nitroApp.hooks.callHook(
    'auth:reset-password',
    {
      token,
      passwordHash: newPasswordHash
    },
    result
  )

  return result.success
}

/**
 * Získá seznam členských a sportovních profilů pro daného uživatele pomocí Nitro Hooku 'auth:get-user-members'.
 * Hook implementuje hostitelská aplikace (např. dotazem do tabulky členů/sportovců podle userId).
 */
export async function getUserMembers(
  userId: string | number
): Promise<ClubMemberProfile[]> {
  const nitroApp = useNitroApp()
  const result: { members: ClubMemberProfile[] } = { members: [] }

  await nitroApp.hooks.callHook('auth:get-user-members', { userId }, result)
  return result.members || []
}

/**
 * Přepne aktivního člena v session pro daný request.
 * Ověří profil přes Nitro hook 'auth:switch-active-member' (nebo fallback přes 'auth:get-user-members')
 * a aktualizuje šifrovanou session pomocí setUserSession.
 */
export async function switchActiveMember(
  event: H3Event,
  memberId: string | number
): Promise<ClubMemberProfile> {
  const user = await requireUser(event)
  const nitroApp = useNitroApp()
  const result: { member: ClubMemberProfile | null } = { member: null }

  // 1. Zkusíme specializovaný hook hostitelské aplikace
  await nitroApp.hooks.callHook(
    'auth:switch-active-member',
    { userId: user.id, memberId },
    result
  )

  let activeMember = result.member

  // 2. Fallback: Pokud hostitelská aplikace neimplementuje přímo 'auth:switch-active-member',
  // dohledáme profil v seznamu profilů uživatele přes 'auth:get-user-members'
  const members = await getUserMembers(user.id)
  if (!activeMember) {
    const found = members.find((m) => String(m.id) === String(memberId))
    if (found) {
      activeMember = found
    }
  }

  // 3. Pokud profil neexistuje nebo nepatří tomuto uživateli, vyvoláme 404
  if (!activeMember) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: `Profil člena s ID "${memberId}" nebyl pro uživatele nalezen.`
    })
  }

  // 4. Aktualizujeme session v nuxt-auth-utils s novým activeMemberId a members
  const currentSession = await getUserSession(event)
  await setUserSession(event, {
    ...currentSession,
    user: {
      ...user,
      activeMemberId: activeMember.id,
      members: members.length > 0 ? members : currentSession.user?.members
    },
    activeMemberId: activeMember.id,
    members: members.length > 0 ? members : currentSession.members
  })

  return activeMember
}

/**
 * Získá seznam sezón v klubu pomocí Nitro hooku 'auth:get-seasons'.
 */
export async function getClubSeasons(): Promise<ClubSeason[]> {
  const nitroApp = useNitroApp()
  const result: { seasons: ClubSeason[] } = { seasons: [] }

  await nitroApp.hooks.callHook('auth:get-seasons', result)
  return result.seasons || []
}

/**
 * Získá seznam poboček pro daného uživatele pomocí Nitro hooku 'auth:get-branches'.
 */
export async function getUserBranches(userId: string | number): Promise<ClubBranch[]> {
  const nitroApp = useNitroApp()
  const result: { branches: ClubBranch[] } = { branches: [] }

  await nitroApp.hooks.callHook('auth:get-branches', { userId }, result)
  return result.branches || []
}

/**
 * Získá seznam uživatelů pro admin správu pomocí Nitro hooku 'admin:list-users'.
 */
export async function listAdminUsers(payload: {
  page?: number
  limit?: number
  search?: string
  role?: AppRole
}): Promise<{ users: ClubUser[]; total: number }> {
  const nitroApp = useNitroApp()
  const result: { users: ClubUser[]; total: number } = { users: [], total: 0 }

  await nitroApp.hooks.callHook('admin:list-users', payload, result)
  return result
}

/**
 * Aktualizuje roli uživatele administrátorem pomocí Nitro hooku 'admin:update-user-role'.
 */
export async function updateAdminUserRole(
  targetUserId: string | number,
  newRole: AppRole
): Promise<boolean> {
  const nitroApp = useNitroApp()
  const result: { success: boolean } = { success: false }

  await nitroApp.hooks.callHook('admin:update-user-role', { targetUserId, newRole }, result)
  return result.success
}

/**
 * Aktualizuje stav uživatele administrátorem pomocí Nitro hooku 'admin:update-user-status'.
 */
export async function updateAdminUserStatus(
  targetUserId: string | number,
  status: 'active' | 'suspended'
): Promise<boolean> {
  const nitroApp = useNitroApp()
  const result: { success: boolean } = { success: false }

  await nitroApp.hooks.callHook('admin:update-user-status', { targetUserId, status }, result)
  return result.success
}

/**
 * Vygeneruje ověřovací token a odešle e-mail pro ověření e-mailové adresy uživatele.
 * Spustí Nitro hook 'auth:send-verification-email'.
 */
export async function sendVerificationEmail(
  userId: string | number,
  email: string,
  baseUrl?: string
): Promise<{ token: string; verifyUrl: string; sent: boolean }> {
  const nitroApp = useNitroApp()
  const token = crypto.randomUUID()
  const cleanBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : ''
  const verifyUrl = cleanBaseUrl
    ? `${cleanBaseUrl}/verify-email?token=${encodeURIComponent(token)}`
    : `/verify-email?token=${encodeURIComponent(token)}`

  const result: { sent: boolean } = { sent: false }
  await nitroApp.hooks.callHook(
    'auth:send-verification-email',
    {
      userId,
      email,
      token,
      verifyUrl
    },
    result
  )

  return {
    token,
    verifyUrl,
    sent: result.sent
  }
}

/**
 * Ověří platnost tokenu pro potvrzení e-mailu pomocí Nitro hooku 'auth:verify-email-token'.
 */
export async function verifyEmailToken(
  token: string
): Promise<{ valid: boolean; userId?: string | number }> {
  const nitroApp = useNitroApp()
  const result: { valid: boolean; userId?: string | number } = { valid: false }

  await nitroApp.hooks.callHook('auth:verify-email-token', { token }, result)
  return result
}

/**
 * Znovu odešle ověřovací e-mail pro daného uživatele pomocí Nitro hooku 'auth:resend-verification-email'.
 */
export async function resendVerificationEmail(
  userId: string | number
): Promise<{ sent: boolean }> {
  const nitroApp = useNitroApp()
  const result: { sent: boolean } = { sent: false }

  await nitroApp.hooks.callHook('auth:resend-verification-email', { userId }, result)
  return result
}

/**
 * Aktualizuje heslo uživatele v DB hostitelské aplikace pomocí Nitro hooku 'auth:update-user-password'.
 */
export async function updateUserPassword(
  userId: string | number,
  newPasswordHash: string
): Promise<boolean> {
  const nitroApp = useNitroApp()
  const result: { success: boolean } = { success: false }

  await nitroApp.hooks.callHook(
    'auth:update-user-password',
    { userId, newPasswordHash },
    result
  )

  return result.success
}

/**
 * Aktualizuje profil uživatele v DB hostitelské aplikace pomocí Nitro hooku 'auth:update-user-profile'.
 */
export async function updateUserProfile(payload: {
  userId: string | number
  name: string
  avatar?: string
}): Promise<ClubUser | null> {
  const nitroApp = useNitroApp()
  const result: { user: ClubUser | null } = { user: null }

  await nitroApp.hooks.callHook('auth:update-user-profile', payload, result)

  return result.user
}

// ==========================================
// Pozvánky členů (Club Member Invitations)
// ==========================================

/**
 * Vytvoří pozvánku člena klubu v hostitelské DB pomocí Nitro hooku 'auth:create-invitation'
 * a volitelně odešle e-mail pomocí 'auth:send-invitation-email'.
 */
export async function createMemberInvitation(payload: {
  email: string
  role: AppRole
  invitedBy: string | number
  category?: string
  expiresInDays?: number
  baseUrl?: string
}): Promise<{ invitation: ClubInvitation; inviteUrl: string; emailSent: boolean }> {
  const nitroApp = useNitroApp()
  const token = crypto.randomUUID()
  const days = payload.expiresInDays ?? 7
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const cleanBaseUrl = payload.baseUrl ? payload.baseUrl.replace(/\/$/, '') : ''
  const inviteUrl = cleanBaseUrl
    ? `${cleanBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`
    : `/accept-invite?token=${encodeURIComponent(token)}`

  const createResult: { invitation: ClubInvitation | null } = { invitation: null }
  await nitroApp.hooks.callHook(
    'auth:create-invitation',
    {
      email: payload.email,
      role: payload.role,
      invitedBy: payload.invitedBy,
      token,
      expiresAt,
      category: payload.category,
      inviteUrl
    },
    createResult
  )

  const invitation: ClubInvitation = createResult.invitation ?? {
    id: token,
    email: payload.email,
    role: payload.role,
    invitedBy: payload.invitedBy,
    token,
    expiresAt,
    category: payload.category,
    createdAt: new Date()
  }

  const sendResult: { sent: boolean } = { sent: false }
  await nitroApp.hooks.callHook(
    'auth:send-invitation-email',
    {
      email: payload.email,
      inviteUrl,
      role: payload.role,
      category: payload.category
    },
    sendResult
  )

  return {
    invitation,
    inviteUrl,
    emailSent: sendResult.sent
  }
}

/**
 * Získá pozvánku podle unikátního tokenu pomocí Nitro hooku 'auth:get-invitation-by-token'.
 */
export async function getInvitationByToken(token: string): Promise<ClubInvitation | null> {
  const nitroApp = useNitroApp()
  const result: { invitation: ClubInvitation | null } = { invitation: null }

  await nitroApp.hooks.callHook('auth:get-invitation-by-token', { token }, result)
  return result.invitation
}

/**
 * Označí pozvánku za přijatou pomocí Nitro hooku 'auth:accept-invitation'.
 */
export async function acceptMemberInvitation(
  token: string,
  userId: string | number
): Promise<boolean> {
  const nitroApp = useNitroApp()
  const result: { success: boolean } = { success: false }

  await nitroApp.hooks.callHook('auth:accept-invitation', { token, userId }, result)
  return result.success
}

/**
 * Získá seznam všech pozvánek pro administrátory / trenéry pomocí Nitro hooku 'admin:list-invitations'.
 */
export async function listMemberInvitations(): Promise<ClubInvitation[]> {
  const nitroApp = useNitroApp()
  const result: { invitations: ClubInvitation[] } = { invitations: [] }

  await nitroApp.hooks.callHook('admin:list-invitations', result)
  return result.invitations || []
}


