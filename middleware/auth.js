/**
 * middleware/auth.js
 * Protege todas las rutas /rrhh/* y redirige al login si no hay sesión activa.
 * Solo corre en el cliente (la sesión vive en localStorage).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Redirigir raíz a la vista principal
  if (to.path === '/' || to.path === '/home') {
    return navigateTo('/rrhh/trabajadores')
  }

  // Solo proteger rutas /rrhh/*
  if (!to.path.startsWith('/rrhh')) return

  // Solo ejecutar en el cliente
  if (!import.meta.client) return

  const raw = localStorage.getItem('rrhh_session')
  if (!raw) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  try {
    const session = JSON.parse(raw)
    if (!session.token || !session.expires || Date.now() > session.expires) {
      localStorage.removeItem('rrhh_session')
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    // Sesión válida en localStorage — dejar pasar.
    // El authStore.init() en el layout restaurará el usuario desde /api/auth/me.
  } catch {
    localStorage.removeItem('rrhh_session')
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
