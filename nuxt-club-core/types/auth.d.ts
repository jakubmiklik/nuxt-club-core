/**
 * nuxt-club-core - Typový systém pro autentizaci a autorizaci (Hybridní RBAC model)
 */

/**
 * Globální základní role vestavěné v jádru layeru
 */
export type BaseRole = 'admin' | 'user'

/**
 * Prázdné rozhraní určené pro TypeScript Declaration Merging v hostitelské aplikaci.
 * Příklad rozšíření v hostitelské aplikaci (např. Judo klub):
 * ```ts
 * declare module 'nuxt-club-core/types/auth' {
 *   interface CustomRoles {
 *     coach: true
 *     member: true
 *     parent: true
 *     referee: true
 *   }
 * }
 * ```
 */
export interface CustomRoles {}

/**
 * Výsledná platná role uživatele v aplikaci (základní role + jakékoliv custom role)
 */
export type AppRole = BaseRole | keyof CustomRoles

/**
 * Úroveň přístupu pro UI komponenty, navigační prvky a middleware
 */
export type AccessLevel = AppRole | 'public'

/**
 * Reprezentace členského a sportovního profilu (sportovec / člen klubu).
 * Uživatel (např. rodič) může mít pod svým účtem přiřazeno více sportovních profilů (např. dětí).
 */
export interface ClubMemberProfile {
  id: string | number
  userId: string | number
  firstName: string
  lastName: string
  birthDate?: string | Date
  licenseNumber?: string
  category?: string
  avatar?: string
  isPrimary?: boolean
  metadata?: Record<string, any>
}

/**
 * Reprezentace sezóny v klubovém systému
 */
export interface ClubSeason {
  id: string | number
  name: string
  isCurrent?: boolean
}

/**
 * Reprezentace pobočky / oddílu v klubovém systému
 */
export interface ClubBranch {
  id: string | number
  name: string
  isPrimary?: boolean
}

/**
 * Reprezentace uživatele v klubovém systému
 */
export interface ClubUser {
  id: string | number
  email: string
  name: string
  role: AppRole
  status?: 'active' | 'suspended' | 'pending'
  avatar?: string
  createdAt?: string | Date
  emailVerified?: boolean
  activeMemberId?: string | number
  members?: ClubMemberProfile[]
  activeSeasonId?: string | number
  activeBranchId?: string | number
  gdprConsentAt?: string | Date
  termsAcceptedVersion?: string
}

export type ClubAuthErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_EXISTS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'ACCOUNT_SUSPENDED'
  | 'INTERNAL_ERROR'

export interface ClubErrorResponse {
  statusCode: number
  code: ClubAuthErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

export type ClubAuditAction =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'register'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'password_changed'
  | 'profile_updated'
  | 'role_changed'
  | 'status_changed'
  | 'invite_sent'
  | 'invite_accepted'

/**
 * Reprezentace pozvánky člena klubu administrátorem nebo trenérem
 */
export interface ClubInvitation {
  id: string | number
  email: string
  role: AppRole
  invitedBy: string | number
  token: string
  expiresAt: string | Date
  category?: string
  acceptedAt?: string | Date
  createdAt?: string | Date
}

/**
 * Interní reprezentace uživatele z databáze obsahující hash hesla
 */
export interface AuthDatabaseUser extends ClubUser {
  passwordHash?: string
}

// Rozšíření typů pro nuxt-auth-utils session
declare module '#auth-utils' {
  interface User {
    id: string | number
    email: string
    name: string
    role: AppRole
    status?: 'active' | 'suspended' | 'pending'
    avatar?: string
    emailVerified?: boolean
    activeMemberId?: string | number
    members?: ClubMemberProfile[]
    activeSeasonId?: string | number
    activeBranchId?: string | number
    gdprConsentAt?: string | Date
    termsAcceptedVersion?: string
  }

  interface UserSession {
    user: User
    loggedInAt?: number
    activeMemberId?: string | number
    members?: ClubMemberProfile[]
    activeSeasonId?: string | number
    activeBranchId?: string | number
  }

  interface SecureSessionData {
    // Případná privátní data vázaná na session
  }
}

// Typování Nitro Hooks pro oddělení databázové vrstvy hostitelské aplikace
declare module 'nitropack' {
  interface NitroRuntimeHooks {
    /**
     * Auditní záznam bezpečnostních a uživatelských událostí
     */
    'auth:audit-log': (payload: {
      action: ClubAuditAction
      userId?: string | number
      email?: string
      ip: string
      userAgent?: string
      metadata?: Record<string, any>
      timestamp: Date
    }) => void | Promise<void>

    /**
     * Získání seznamu sezón v klubu
     */
    'auth:get-seasons': (
      result: { seasons: ClubSeason[] }
    ) => void | Promise<void>

    /**
     * Získání seznamu poboček pro daného uživatele
     */
    'auth:get-branches': (
      payload: { userId: string | number },
      result: { branches: ClubBranch[] }
    ) => void | Promise<void>

    /**
     * Získání seznamu uživatelů pro administraci (stránkování, vyhledávání, filtrování dle role)
     */
    'admin:list-users': (
      payload: { page?: number; limit?: number; search?: string; role?: AppRole },
      result: { users: ClubUser[]; total: number }
    ) => void | Promise<void>

    /**
     * Změna role uživatele administrátorem
     */
    'admin:update-user-role': (
      payload: { targetUserId: string | number; newRole: AppRole },
      result: { success: boolean }
    ) => void | Promise<void>

    /**
     * Změna stavu uživatele administrátorem (aktivace/pozastavení)
     */
    'admin:update-user-status': (
      payload: { targetUserId: string | number; status: 'active' | 'suspended' },
      result: { success: boolean }
    ) => void | Promise<void>

    /**
     * Získání seznamu členských / sportovních profilů pro daného uživatele
     */
    'auth:get-user-members': (
      payload: { userId: string | number },
      result: { members: ClubMemberProfile[] }
    ) => void | Promise<void>

    /**
     * Ověření a přepnutí aktivního člena pro daného uživatele
     */
    'auth:switch-active-member': (
      payload: { userId: string | number; memberId: string | number },
      result: { member: ClubMemberProfile | null }
    ) => void | Promise<void>

    /**
     * Vyhledání uživatele v DB hostitelské aplikace podle e-mailu (včetně passwordHash)
     */
    'auth:find-user-by-email': (
      payload: { email: string },
      result: { user: AuthDatabaseUser | null }
    ) => void | Promise<void>

    /**
     * Vyhledání uživatele v DB podle ID
     */
    'auth:find-user-by-id': (
      payload: { id: string | number },
      result: { user: AuthDatabaseUser | null }
    ) => void | Promise<void>

    /**
     * Vytvoření nového uživatele v DB hostitelské aplikace
     */
    'auth:create-user': (
      payload: {
        email: string
        name: string
        passwordHash: string
        role?: AppRole
        gdprConsentAt?: string | Date
        termsAcceptedVersion?: string
      },
      result: { user: ClubUser | null }
    ) => void | Promise<void>

    /**
     * Vyhledání nebo vytvoření uživatele po úspěšném Google nebo Seznam OAuth přihlášení
     */
    'auth:find-or-create-oauth-user': (
      payload: {
        provider: 'google' | 'seznam'
        email: string
        name: string
        avatar?: string
        providerId?: string
      },
      result: { user: ClubUser | null }
    ) => void | Promise<void>

    /**
     * Odeslání e-mailu s odkazem pro ověření e-mailové adresy
     */
    'auth:send-verification-email': (
      payload: { userId: string | number; email: string; token: string; verifyUrl: string },
      result: { sent: boolean }
    ) => void | Promise<void>

    /**
     * Ověření tokenu pro potvrzení e-mailu
     */
    'auth:verify-email-token': (
      payload: { token: string },
      result: { valid: boolean; userId?: string | number }
    ) => void | Promise<void>

    /**
     * Znovuzaslání ověřovacího e-mailu pro daného uživatele
     */
    'auth:resend-verification-email': (
      payload: { userId: string | number },
      result: { sent: boolean }
    ) => void | Promise<void>

    /**
     * Vygenerování tokenu pro obnovu hesla
     */
    'auth:generate-password-reset-token': (
      payload: { email: string },
      result: { token: string | null; resetUrl?: string }
    ) => void | Promise<void>

    /**
     * Odeslání e-mailu s odkazem pro obnovu hesla
     */
    'auth:send-password-reset-email': (
      payload: { email: string; token: string; resetUrl: string },
      result: { sent: boolean }
    ) => void | Promise<void>

    /**
     * Ověření platnosti tokenu pro obnovu hesla
     */
    'auth:verify-password-reset-token': (
      payload: { token: string },
      result: { valid: boolean; email?: string }
    ) => void | Promise<void>

    /**
     * Nastavení nového hesla na základě platného tokenu
     */
    'auth:reset-password': (
      payload: { token: string; passwordHash: string },
      result: { success: boolean }
    ) => void | Promise<void>

    /**
     * Změna hesla přihlášeného uživatele
     */
    'auth:update-user-password': (
      payload: { userId: string | number; newPasswordHash: string },
      result: { success: boolean }
    ) => void | Promise<void>

    /**
     * Aktualizace profilu uživatele (jméno, avatar)
     */
    'auth:update-user-profile': (
      payload: { userId: string | number; name: string; avatar?: string },
      result: { user: ClubUser | null }
    ) => void | Promise<void>

    /**
     * Vytvoření pozvánky člena klubu administrátorem nebo trenérem
     */
    'auth:create-invitation': (
      payload: {
        email: string
        role: AppRole
        invitedBy: string | number
        token: string
        expiresAt: Date
        category?: string
        inviteUrl: string
      },
      result: { invitation: ClubInvitation | null }
    ) => void | Promise<void>

    /**
     * Odeslání e-mailu s pozvánkou do klubu
     */
    'auth:send-invitation-email': (
      payload: { email: string; inviteUrl: string; role: AppRole; category?: string },
      result: { sent: boolean }
    ) => void | Promise<void>

    /**
     * Vyhledání pozvánky podle unikátního tokenu
     */
    'auth:get-invitation-by-token': (
      payload: { token: string },
      result: { invitation: ClubInvitation | null }
    ) => void | Promise<void>

    /**
     * Označení pozvánky jako přijaté
     */
    'auth:accept-invitation': (
      payload: { token: string; userId: string | number },
      result: { success: boolean }
    ) => void | Promise<void>

    /**
     * Výpis všech pozvánek pro administrátory a trenéry
     */
    'admin:list-invitations': (
      result: { invitations: ClubInvitation[] }
    ) => void | Promise<void>
  }
}

// Typování PageMeta pro Nuxt klientské guards (definePageMeta)
declare module '#app' {
  interface PageMeta {
    /**
     * Vyžadovaná role nebo pole rolí pro přístup na stránku
     */
    role?: AppRole | AppRole[]
    roles?: AppRole[]
    /**
     * Volitelné přepsání URL pro přesměrování při neautorizovaném přístupu
     */
    unauthorizedRedirect?: string
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    role?: AppRole | AppRole[]
    roles?: AppRole[]
    unauthorizedRedirect?: string
  }
}

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    clubAuth?: {
      loginPath?: string
      registerPath?: string
      defaultRedirect?: string
      unauthorizedRedirect?: string
    }
  }
}

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    clubAuth?: {
      loginPath?: string
      registerPath?: string
      defaultRedirect?: string
      unauthorizedRedirect?: string
    }
  }
}
