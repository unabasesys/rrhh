/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado a partir del token Bearer.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  return { ok: true, user }
})
