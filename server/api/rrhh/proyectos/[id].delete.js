import Proyecto from '../../../models/Proyecto.js'
import Linea from '../../../models/Linea.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = getRouterParam(event, 'id')

  const existing = await Proyecto.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Proyecto no encontrado' })
  requireOrgAccess(user, existing.orgId)

  await Linea.deleteMany({ proyectoId: id })
  await Proyecto.findByIdAndDelete(id)
  return { ok: true }
})
