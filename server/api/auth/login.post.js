/**
 * POST /api/auth/login
 * Autentica al usuario, guarda el token en MongoDB y lo devuelve al cliente.
 */
import { requireDb } from '../../utils/db.js'
import User from '../../models/User.js'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)

  const body = await readBody(event)
  const { email, password, remember = false } = body || {}

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email y contraseña requeridos' })
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() })
  if (!user) {
    throw createError({ statusCode: 401, message: 'Email no encontrado' })
  }
  if (!user.activo) {
    throw createError({ statusCode: 403, message: 'Usuario desactivado' })
  }

  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) {
    throw createError({ statusCode: 401, message: 'Contraseña incorrecta' })
  }

  // Generar token y guardarlo en el usuario
  const token        = generateToken()
  const tokenExpires = new Date(Date.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000))

  user.token        = token
  user.tokenExpires = tokenExpires
  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()
  return {
    ok:      true,
    token,
    expires: tokenExpires.getTime(),
    user:    safeUser,
  }
})
