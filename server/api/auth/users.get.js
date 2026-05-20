/**
 * GET /api/auth/users
 * Lista de usuarios (solo admins autenticados).
 * Por ahora sin verificación de JWT — se agrega en la siguiente fase.
 */
import { requireDb } from '@/server/utils/db'
import User from '@/server/models/User'

export default defineEventHandler(async (event) => {
  requireDb(event)

  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: 1 }).lean()
  return users
})
