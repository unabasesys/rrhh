import Linea from '../../../models/Linea.js'
import Proyecto from '../../../models/Proyecto.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)

  const existing = await Linea.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Línea no encontrada' })

  // Las líneas se scopean por el proyecto padre
  const proyecto = existing.proyectoId ? await Proyecto.findById(existing.proyectoId).lean() : null
  requireOrgAccess(user, proyecto?.orgId || existing.orgId)

  // Evitar reparentar la línea a otro proyecto / tenant hopping
  const { _id: _i, proyectoId: _p, ...safe } = body

  const doc  = await Linea.findByIdAndUpdate(id, safe, { new: true }).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Línea no encontrada' })
  return doc
})
