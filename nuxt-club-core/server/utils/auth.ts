import type { H3Event } from 'h3'
import type { AppRole, ClubUser, AuthDatabaseUser } from '../../types/auth'

/**
 * Získá aktuálně přihlášeného uživatele ze šifrované session.
 * Pokud uživatel není přihlášen, vyvolá HTTP 401 Unauthorized.
 */
export async function requireUser(event: H3Event): Promise<ClubUser> {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
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
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
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
 * Vyhledá nebo založí uživatele při přihlášení přes OAuth (Google).
 */
export async function findOrCreateOAuthUser(data: {
  provider: 'google'
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
export const oauthGoogleEventHandler = defineOAuthGoogleEventHandler
