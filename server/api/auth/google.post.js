/**
 * POST /api/auth/google
 *
 * Recibe el credential (ID token JWT) de Google Identity Services,
 * verifica la firma contra Google y crea o autentica al usuario.
 *
 * Si es la primera vez (usuario no existe):
 *   - Crea el User con datos del payload de Google (email, nombre, foto)
 *   - Pre-asigna la org "Empresa DEMO SPA" si existe
 *   - Rol: 'manager' (no admin global)
 *
 * Si ya existe:
 *   - Reutiliza la cuenta y genera token nuevo
 *
 * Variable de entorno requerida:
 *   GOOGLE_CLIENT_ID — Client ID OAuth 2.0 de Google Cloud Console
 *
 * Body: { credential: string }   ← el JWT que devuelve GIS
 * Retorna: { ok, token, expires, user, currentOrgId }
 */
import { requireDb, newId } from '../../utils/db.js'
import User from '../../models/User.js'
import Organization from '../../models/Organization.js'
import { OAuth2Client } from 'google-auth-library'

function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw createError({
      statusCode: 503,
      message: 'Google Sign-In no configurado. Define GOOGLE_CLIENT_ID en las variables de entorno.',
    })
  }

  const body = await readBody(event)
  const credential = body?.credential
  if (!credential) {
    throw createError({ statusCode: 400, message: 'credential requerido' })
  }

  // Verificar el ID token contra Google
  let payload
  try {
    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
    payload = ticket.getPayload()
  } catch (e) {
    throw createError({ statusCode: 401, message: 'Token de Google inválido' })
  }

  if (!payload?.email) {
    throw createError({ statusCode: 401, message: 'Google no devolvió email' })
  }
  const email  = payload.email.toLowerCase().trim()
  const nombre = payload.name || payload.given_name || email.split('@')[0]
  const foto   = payload.picture || null

  // Buscar usuario o crearlo
  let user = await User.findOne({ email })
  let creado = false
  if (!user) {
    creado = true
    const demoOrg = await Organization.findOne({ nombre: /^Empresa DEMO SPA$/i }).lean()
    user = new User({
      _id:          newId('u'),
      email,
      nombre,
      // Sin passwordHash — solo Google
      passwordHash: null,
      googleId:     payload.sub || null,
      avatar:       foto,
      rol:          'manager',
      orgId:        demoOrg?._id || null,
      orgIds:       demoOrg ? [demoOrg._id] : [],
      activo:       true,
      creado:       new Date(),
    })
  } else {
    // Actualizar avatar/googleId si vienen
    if (!user.googleId && payload.sub) user.googleId = payload.sub
    if (!user.avatar && foto)          user.avatar = foto
    if (!user.activo) {
      throw createError({ statusCode: 403, message: 'Usuario desactivado' })
    }
  }

  // Generar token y persistir
  const token = generateToken()
  const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  user.token        = token
  user.tokenExpires = tokenExpires
  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()

  // currentOrgId del usuario o de la primera org accesible
  const currentOrgId = user.orgId || user.orgIds?.[0] || null

  return {
    ok:           true,
    creado,
    token,
    expires:      tokenExpires.getTime(),
    user:         safeUser,
    currentOrgId,
  }
})
