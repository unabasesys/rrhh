// Módulo RRHH independiente — sin autenticación requerida
// Al integrar con Unabase OS, este middleware se conectará al sistema de auth central
export default defineNuxtRouteMiddleware((to) => {
  // Redirigir raíz a la vista principal
  if (to.path === '/' || to.path === '/home') {
    return navigateTo('/rrhh/trabajadores')
  }
})
