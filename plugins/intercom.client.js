/**
 * plugins/intercom.client.js
 * Integración del Messenger de Intercom (solo cliente) vía el SDK oficial
 * @intercom/messenger-js-sdk.
 *
 * - Identifica al usuario autenticado en el boot ({ user_id, name, email,
 *   created_at }).
 * - En login/cambio de usuario reinicia la sesión del Messenger.
 * - En logout hace shutdown() y reinicia como visitante anónimo.
 * - update() en cada cambio de ruta para navegación SPA.
 *
 * El app_id sale de runtimeConfig.public.intercomAppId (env INTERCOM_APP_ID).
 */
import Intercom, { shutdown, update } from '@intercom/messenger-js-sdk'
import { useAuthStore } from '@/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  const appId = nuxtApp.$config?.public?.intercomAppId
  if (!appId) return  // sin app_id configurado, no cargamos nada

  const auth = useAuthStore()

  // Unix timestamp en segundos (Intercom lo espera así). Acepta createdAt
  // (timestamps de Mongoose) o `creado` (campo legacy) como fecha de registro.
  function createdAtUnix(user) {
    const raw = user?.createdAt || user?.creado
    if (!raw) return undefined
    const ms = new Date(raw).getTime()
    return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000)
  }

  // boot: identifica si hay usuario, o arranca como visitante anónimo.
  function boot(user) {
    const settings = { app_id: appId }
    if (user) {
      settings.user_id = user._id
      settings.name    = user.nombre
      settings.email   = user.email
      const created = createdAtUnix(user)
      if (created) settings.created_at = created
    }
    Intercom(settings)
  }

  // Estado inicial (el store puede estar ya hidratado al cargar el plugin)
  boot(auth.user)

  // Reaccionar a login / logout / cambio de usuario
  watch(
    () => auth.user,
    (user, prev) => {
      if (user) {
        if (prev && prev._id !== user._id) shutdown()  // cambio de cuenta
        boot(user)
      } else if (prev) {
        shutdown()   // logout: limpia la conversación del usuario anterior
        boot(null)   // reinicia como visitante anónimo
      }
    }
  )

  // Registrar navegación SPA
  nuxtApp.$router?.afterEach(() => {
    try { update() } catch {}
  })
})
