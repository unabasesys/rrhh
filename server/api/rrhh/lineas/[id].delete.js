import Linea from '../../../models/Linea.js'
import Proyecto from '../../../models/Proyecto.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = getRouterParam(event, 'id')

  const existing = await Linea.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Línea no encontrada' })

  // Las líneas se scopean por el proyecto padre
  const proyecto = existing.proyectoId ? await Proyecto.findById(existing.proyectoId).lean() : null
  requireOrgAccess(user, proyecto?.orgId || existing.orgId)

  await Linea.findByIdAndDelete(id)
  return { ok: true }
})
