/**
 * server/utils/requireAuth.js
 * Verifica el token Bearer en el header Authorization.
 * Retorna el usuario si es válido, lanza 401/403 si no.
 */
import User from '../models/User.js'

export async function requireAuth(event, requiredRole = null) {
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    throw createError({ statusCode: 401, message: 'No autenticado' })
  }

  const user = await User.findOne(
    { token, tokenExpires: { $gt: new Date() } },
    { passwordHash: 0 }
  ).lean()

  if (!user) {
    throw createError({ statusCode: 401, message: 'Sesión inválida o expirada' })
  }
  if (!user.activo) {
    throw createError({ statusCode: 403, message: 'Usuario desactivado' })
  }

  if (requiredRole === 'admin' && user.rol !== 'admin') {
    throw createError({ statusCode: 403, message: 'Se requiere rol Admin' })
  }

  return user
}
