/**
 * plugins/intercom.client.js
 * Integración del Messenger de Intercom (solo cliente).
 *
 * - Carga el widget una sola vez.
 * - Cuando hay un usuario autenticado, lo identifica con boot({ user_id,
 *   name, email, created_at }).
 * - En logout hace shutdown() para limpiar la sesión del Messenger.
 * - En cada cambio de ruta hace update() para que Intercom registre la
 *   navegación (SPA).
 *
 * El app_id sale de runtimeConfig.public.intercomAppId (env INTERCOM_APP_ID).
 */
import { useAuthStore } from '@/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  const appId = nuxtApp.$config?.public?.intercomAppId
  if (!appId) return  // sin app_id configurado, no cargamos nada

  // ── Loader oficial de Intercom (inyecta el script del widget una vez) ──────
  const w = window
  const ic = w.Intercom
  if (typeof ic === 'function') {
    ic('reattach_activator')
    ic('update', w.intercomSettings)
  } else {
    const i = function () { i.c(arguments) }
    i.q = []
    i.c = function (args) { i.q.push(args) }
    w.Intercom = i
    const load = function () {
      const s = document.createElement('script')
      s.type = 'text/javascript'
      s.async = true
      s.src = `https://widget.intercom.io/widget/${appId}`
      const x = document.getElementsByTagName('script')[0]
      x.parentNode.insertBefore(s, x)
    }
    if (document.readyState === 'complete') load()
    else w.addEventListener('load', load, false)
  }

  // ── Identificación según el usuario logueado ───────────────────────────────
  const auth = useAuthStore()

  // Unix timestamp en segundos (Intercom lo espera así). Acepta createdAt
  // (timestamps de Mongoose) o `creado` (campo legacy) como fecha de registro.
  function createdAtUnix(user) {
    const raw = user?.createdAt || user?.creado
    if (!raw) return undefined
    const ms = new Date(raw).getTime()
    return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000)
  }

  function bootFor(user) {
    const settings = {
      api_base: 'https://api-iam.intercom.io',
      app_id:   appId,
    }
    if (user) {
      settings.user_id    = user._id
      settings.name       = user.nombre
      settings.email      = user.email
      const created = createdAtUnix(user)
      if (created) settings.created_at = created
    }
    w.intercomSettings = settings
    // boot funciona tanto para visitantes anónimos como identificados.
    w.Intercom('boot', settings)
  }

  // Estado inicial (por si el store ya está hidratado al cargar el plugin)
  bootFor(auth.user)

  // Reaccionar a login / logout / cambios del usuario
  watch(
    () => auth.user,
    (user, prev) => {
      if (user) {
        // login o cambio de usuario: reinicia la sesión del Messenger
        if (prev && prev._id !== user._id) w.Intercom('shutdown')
        bootFor(user)
      } else if (prev) {
        // logout: limpia la conversación del usuario anterior
        w.Intercom('shutdown')
        bootFor(null)  // reinicia como visitante anónimo
      }
    }
  )

  // Registrar navegación SPA para que Intercom detecte cada página
  nuxtApp.$router?.afterEach(() => {
    if (typeof w.Intercom === 'function') w.Intercom('update', w.intercomSettings)
  })
})
