import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const doc = await Trabajador.findById(id).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  requireOrgAccess(user, doc.orgId)
  return doc
})
