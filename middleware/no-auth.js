/**
 * middleware/no-auth.js
 * Redirige a usuarios ya autenticados fuera de las páginas de login.
 */
export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return

  try {
    const raw = localStorage.getItem('rrhh_session')
    if (!raw) return

    const session = JSON.parse(raw)
    if (session?.token && session?.expires > Date.now()) {
      return navigateTo('/rrhh/trabajadores')
    }
  } catch {}
})
