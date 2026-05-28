import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  const existing = await Liquidacion.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Liquidación no encontrada' })
  requireOrgAccess(user, existing.orgId)

  await Liquidacion.findByIdAndDelete(id)
  return { ok: true }
})
