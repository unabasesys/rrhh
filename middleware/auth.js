/**
 * middleware/auth.js
 * Protege todas las rutas /rrhh/* y redirige al login si no hay sesión activa.
 * Solo corre en el cliente (la sesión vive en localStorage).
 *
 * Reglas de rol:
 *   - viewer: no puede entrar a /rrhh/*. Se redirige a su portal personal.
 *   - admin/manager: acceso normal.
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

    // Viewer (trabajador): no entra al módulo admin. Se manda al portal personal.
    if (session.rol === 'viewer') {
      return navigateTo('/portal/mi-perfil')
    }

    // Sesión válida — dejar pasar.
  } catch {
    localStorage.removeItem('rrhh_session')
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
