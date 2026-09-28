/**
 * server/middleware/auth-guard.js
 * Middleware global de autenticación (defensa en profundidad).
 *
 * Exige un Bearer token válido para TODA ruta bajo /api/rrhh/*, /api/orgs/* y
 * los endpoints de gestión de /api/auth/* (users, me, wizard-complete).
 * Si un handler olvida llamar requireAuth, igual queda protegido acá.
 *
 * Rutas EXCLUIDAS (públicas por diseño):
 *   - /api/auth/login|register|google|logout   (autenticación en sí)
 *   - /api/portal/*                            (portal del trabajador, token propio en URL)
 *   - /api/rrhh/billing/webhook/*              (webhooks externos, validados por firma)
 *   - todo lo que no sea /api/                 (páginas SSR, assets, etc.)
 *
 * Al validar, adjunta el usuario en event.context.authUser para que
 * requireAuth lo reutilice sin re-consultar la DB.
 */
import mongoose from 'mongoose'
import { resolveUserFromToken } from '../utils/requireAuth.js'

// Prefijos que SÍ se protegen
const PROTECTED = [
  '/api/rrhh/',
  '/api/orgs',
  '/api/auth/users',
  '/api/auth/me',
  '/api/auth/wizard-complete',
]

// Lo único de /api/rrhh/* que un viewer (trabajador) puede consultar
const VIEWER_OK = [
  '/api/rrhh/billing/status',
]

// Excepciones públicas (evaluadas dentro del set protegido)
const PUBLIC = [
  '/api/rrhh/billing/webhook/',
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Solo actuamos sobre rutas protegidas
  if (!PROTECTED.some(p => path.startsWith(p))) return
  if (PUBLIC.some(p => path.startsWith(p))) return

  // Si Mongo no está conectado, dejamos pasar: el handler responderá 503 vía
  // requireDb. Evita 500 feos en dev sin DB.
  if (mongoose.connection.readyState !== 1) return

  const user = await resolveUserFromToken(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'No autenticado' })
  }
  event.context.authUser = user

  // El trabajador (viewer) usa solo su portal (/api/portal/*): el módulo de
  // RRHH trae sueldos, contratos y liquidaciones de TODA la empresa. Único
  // endpoint que el portal consulta acá: el aviso de pago pendiente.
  if (user.rol === 'viewer' && path.startsWith('/api/rrhh/') && !VIEWER_OK.some(p => path.startsWith(p))) {
    throw createError({ statusCode: 403, message: 'Sin acceso al módulo de RRHH' })
  }
})
