import type { UserRole } from '../../types/auth'

/**
 * Klientský guard pro ověření role přihlášeného uživatele (RBAC).
 * Čte nastavení rolí z `definePageMeta({ role: 'admin' })` nebo `{ roles: ['admin', 'coach'] }`.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()
  const config = useRuntimeConfig()
  const loginPath = config.public?.clubAuth?.loginPath || '/login'
  const unauthorizedRedirect =
    (to.meta.unauthorizedRedirect as string) ||
    config.public?.clubAuth?.unauthorizedRedirect ||
    '/'

  // 1. Získáme definované role z meta stránky
  const requiredRoleMeta = to.meta.role || to.meta.roles
  if (!requiredRoleMeta) {
    // Stránka nevyžaduje specifickou roli
    return
  }

  const allowedRoles: UserRole[] = Array.isArray(requiredRoleMeta)
    ? (requiredRoleMeta as UserRole[])
    : [requiredRoleMeta as UserRole]

  // 2. Pokud uživatel není vůbec přihlášen, pošleme ho na login
  if (!loggedIn.value || !user.value) {
    return navigateTo({
      path: loginPath,
      query: {
        redirect: to.fullPath
      }
    })
  }

  // 3. Ověříme shodu role
  const currentUserRole = user.value.role as UserRole
  const hasAccess = allowedRoles.includes(currentUserRole)

  if (!hasAccess) {
    // Pokud je definován klientský redirect na error page
    if (unauthorizedRedirect && unauthorizedRedirect !== to.path) {
      return navigateTo(unauthorizedRedirect)
    }

    // Případně vyhodíme standardní Nuxt 403 chybu
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `Tato sekce vyžaduje roli: ${allowedRoles.join(', ')}. Vaše role je: ${currentUserRole}.`
    })
  }
})
