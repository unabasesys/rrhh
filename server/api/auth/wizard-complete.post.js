/**
 * POST /api/auth/wizard-complete
 * Marca el wizard de onboarding como completado para el usuario autenticado.
 * Persistido en la DB para que sea cross-device.
 */
import User from '../../models/User.js'
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  await User.updateOne({ _id: me._id }, { $set: { wizardCompleted: true } })
  return { ok: true }
})
