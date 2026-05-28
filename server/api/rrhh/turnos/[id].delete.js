import Turno from '../../../models/Turno.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = getRouterParam(event, 'id')

  const existing = await Turno.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Turno no encontrado' })
  requireOrgAccess(user, existing.orgId)

  await Turno.findByIdAndDelete(id)
  return { ok: true }
})
