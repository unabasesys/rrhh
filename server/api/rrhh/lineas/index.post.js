import Linea from '../../../models/Linea.js'
import Proyecto from '../../../models/Proyecto.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)

  // Validar que el proyecto padre pertenezca a una org accesible por el usuario
  if (body.proyectoId) {
    const proyecto = await Proyecto.findById(body.proyectoId).lean()
    if (!proyecto) throw createError({ statusCode: 404, message: 'Proyecto no encontrado' })
    requireOrgAccess(user, proyecto.orgId)
  } else {
    requireOrgAccess(user, body.orgId)
  }

  const doc = new Linea({ _id: body.id || newId('lin'), ...body })
  await doc.save()
  return doc.toObject()
})
