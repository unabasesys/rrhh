/**
 * POST /api/auth/logout
 * Invalida el token del usuario en MongoDB.
 */
import { requireDb } from '../../utils/db.js'
import User from '../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)

  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (token) {
    await User.updateOne({ token }, { $set: { token: null, tokenExpires: null } })
  }

  return { ok: true }
})
