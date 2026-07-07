import Contrato from '../../../models/Contrato.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const existing = await Contrato.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Contrato no encontrado' })
  requireOrgAccess(user, existing.orgId)

  // Evitar tenant hopping / reparentar el contrato
  const { orgId: _o, _id: _i, trabajador_id: _t, ...safe } = body

  const doc = await Contrato.findByIdAndUpdate(id, safe, { new: true }).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Contrato no encontrado' })
  return doc
})
