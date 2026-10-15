// Candado de emergencia: corre en CADA navegación, antes que `middleware/auth.js`
// (no es global). No mira sesión ni organización — bloquea a todo el mundo por
// igual, que es el punto. Mismo patrón que Calendar y Relations.
export default defineNuxtRouteMiddleware((to) => {
  const { public: { maintenanceMode } } = useRuntimeConfig()
  if (!maintenanceMode) return
  if (to.path === '/mantenimiento') return
  return navigateTo('/mantenimiento', { replace: true })
})
