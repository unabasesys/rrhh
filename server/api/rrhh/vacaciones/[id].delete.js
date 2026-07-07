import Vacacion from '../../../models/Vacacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

/**
 * DELETE /api/rrhh/vacaciones/:id
 * Solo manager/admin. Útil para limpiar errores; las solicitudes válidas se
 * rechazan en vez de borrarse para mantener la trazabilidad.
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = event.context.params.id

  const vac = await Vacacion.findById(id).lean()
  if (!vac) throw createError({ statusCode: 404, message: 'No encontrada' })
  requireOrgAccess(user, vac.orgId)

  await Vacacion.deleteOne({ _id: id })
  return { ok: true }
})
