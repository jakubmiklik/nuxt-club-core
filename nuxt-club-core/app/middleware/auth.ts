/**
 * Klientský auth guard.
 * Přesměruje nepřihlášené návštěvníky na přihlašovací stránku (/login).
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  const config = useRuntimeConfig()
  const loginPath = config.public?.clubAuth?.loginPath || '/login'

  // Pokud uživatel není přihlášen a cílová stránka není samotný login
  if (!loggedIn.value && to.path !== loginPath) {
    return navigateTo({
      path: loginPath,
      query: {
        redirect: to.fullPath
      }
    })
  }
})
