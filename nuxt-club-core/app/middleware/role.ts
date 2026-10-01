import type { AppRole } from '../../types/auth'

/**
 * Klientský guard pro ověření role přihlášeného uživatele (Hybridní RBAC model).
 * Kontroluje role definované v definePageMeta({ roles: ['admin', ...] }) nebo definePageMeta({ role: 'admin' }).
 *
 * Pravidla:
 * 1. Pokud stránka nedefinuje žádnou vyžadovanou roli, přístup je povolen.
 * 2. Pokud uživatel není přihlášen, je přesměrován na přihlašovací stránku (/login).
 * 3. Uživatel s rolí 'admin' má přístup automaticky povolen (superadmin pass).
 * 4. Pokud uživatel nemá žádnou z povolených rolí, je přesměrován na unauthorizedRedirect nebo vyvolá 403.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()
  const config = useRuntimeConfig()
  const loginPath = config.public?.clubAuth?.loginPath || '/login'
  const unauthorizedRedirect =
    (to.meta.unauthorizedRedirect as string) ||
    config.public?.clubAuth?.unauthorizedRedirect ||
    '/'

  // 1. Získáme vyžadované role z meta informací stránky
  const requiredRoleMeta = to.meta.roles || to.meta.role
  if (!requiredRoleMeta) {
    return
  }

  const allowedRoles: AppRole[] = Array.isArray(requiredRoleMeta)
    ? (requiredRoleMeta as AppRole[])
    : [requiredRoleMeta as AppRole]

  // 2. Pokud uživatel není vůbec přihlášen, pošleme ho na login
  if (!loggedIn.value || !user.value) {
    return navigateTo({
      path: loginPath,
      query: {
        redirect: to.fullPath
      }
    })
  }

  const currentUserRole = user.value.role as AppRole

  // 3. Uživatel s rolí 'admin' má automatický přístup
  if (currentUserRole === 'admin') {
    return
  }

  // 4. Ověříme shodu role
  const hasAccess = allowedRoles.includes(currentUserRole)

  if (!hasAccess) {
    // Pokud je definován klientský redirect na chybovou stránku / domovskou stránku
    if (unauthorizedRedirect && unauthorizedRedirect !== to.path) {
      return navigateTo(unauthorizedRedirect)
    }

    // Případně vyhodíme standardní Nuxt 403 chybu
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `Tato sekce vyžaduje roli: ${allowedRoles.join(', ')}. Vaše role je: ${String(currentUserRole)}.`
    })
  }
})
