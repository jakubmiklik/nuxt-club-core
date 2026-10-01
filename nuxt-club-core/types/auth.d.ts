/**
 * nuxt-club-core - Typový systém pro autentizaci a autorizaci (RBAC)
 */

export type UserRole = 'admin' | 'coach' | 'member' | 'parent'

export interface ClubUser {
  id: string | number
  email: string
  name: string
  role: UserRole
  avatar?: string
  createdAt?: string | Date
}

export interface AuthDatabaseUser extends ClubUser {
  passwordHash?: string
}

// Rozšíření typů pro nuxt-auth-utils
declare module '#auth-utils' {
  interface User {
    id: string | number
    email: string
    name: string
    role: UserRole
    avatar?: string
  }

  interface UserSession {
    user: User
    loggedInAt?: number
  }

  interface SecureSessionData {
    // Případná privátní data vázaná na session
  }
}

// Typování Nitro Hooks pro oddělení databázové vrstvy hostitelské aplikace
declare module 'nitropack' {
  interface NitroRuntimeHooks {
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
        role?: UserRole
      },
      result: { user: ClubUser | null }
    ) => void | Promise<void>

    /**
     * Vyhledání nebo vytvoření uživatele po úspěšném Google OAuth přihlášení
     */
    'auth:find-or-create-oauth-user': (
      payload: {
        provider: 'google'
        email: string
        name: string
        avatar?: string
        providerId?: string
      },
      result: { user: ClubUser | null }
    ) => void | Promise<void>
  }
}

// Typování PageMeta pro Nuxt klientské guards (definePageMeta)
declare module '#app' {
  interface PageMeta {
    /**
     * Vyžadovaná role nebo pole rolí pro přístup na stránku
     */
    role?: UserRole | UserRole[]
    roles?: UserRole[]
    /**
     * Volitelné přepsání URL pro přesměrování při neautorizovaném přístupu
     */
    unauthorizedRedirect?: string
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    role?: UserRole | UserRole[]
    roles?: UserRole[]
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
