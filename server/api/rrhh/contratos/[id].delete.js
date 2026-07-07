import Contrato from '../../../models/Contrato.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = getRouterParam(event, 'id')

  const existing = await Contrato.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Contrato no encontrado' })
  requireOrgAccess(user, existing.orgId)

  await Contrato.findByIdAndDelete(id)
  return { ok: true }
})
