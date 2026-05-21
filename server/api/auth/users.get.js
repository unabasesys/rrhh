/**
 * GET /api/auth/users
 * Lista de usuarios — requiere ser admin autenticado.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import User from '../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'admin')

  const users = await User.find({}, { passwordHash: 0, token: 0, tokenExpires: 0 })
    .sort({ createdAt: 1 })
    .lean()
  return users
})
