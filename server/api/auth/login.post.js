/**
 * POST /api/auth/login
 * Autenticación via MongoDB (producción).
 * En modo sin DB, el store usa localStorage directamente.
 */
import { requireDb } from '@/server/utils/db'
import User from '@/server/models/User'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken() {
  const arr = new Uint8Array(24)
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

  const user = await User.findOne({ email: email.toLowerCase().trim() }).lean()
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

  const token   = generateToken()
  const expires = Date.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000)

  // Retornar sesión al cliente
  const { passwordHash: _, ...safeUser } = user
  return {
    ok:      true,
    token,
    expires,
    user:    safeUser,
  }
})
