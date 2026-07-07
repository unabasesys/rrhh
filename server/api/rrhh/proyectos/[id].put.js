import Proyecto from '../../../models/Proyecto.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)

  const existing = await Proyecto.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Proyecto no encontrado' })
  requireOrgAccess(user, existing.orgId)

  // Evitar tenant hopping
  const { orgId: _o, _id: _i, ...safe } = body

  const doc  = await Proyecto.findByIdAndUpdate(id, safe, { new: true }).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Proyecto no encontrado' })
  return doc
})
