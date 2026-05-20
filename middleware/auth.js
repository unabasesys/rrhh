// Middleware de autenticación RRHH
// Protege todas las rutas /rrhh/* y redirige al login si no hay sesión activa

const PUBLIC_ROUTES = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  // Redirigir raíz a la vista principal
  if (to.path === '/' || to.path === '/home') {
    return navigateTo('/rrhh/trabajadores')
  }

  // Rutas públicas: no verificar
  if (PUBLIC_ROUTES.some(r => to.path.startsWith(r))) return

  // Solo proteger rutas /rrhh/*
  if (!to.path.startsWith('/rrhh')) return

  // Verificar sesión en localStorage (solo client-side)
  if (typeof localStorage === 'undefined') return // SSR: dejar pasar

  const raw = localStorage.getItem('rrhh_session')
  if (!raw) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  try {
    const session = JSON.parse(raw)
    if (!session.token || !session.userId) {
      localStorage.removeItem('rrhh_session')
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    if (session.expires && Date.now() > session.expires) {
      localStorage.removeItem('rrhh_session')
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  } catch {
    localStorage.removeItem('rrhh_session')
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
