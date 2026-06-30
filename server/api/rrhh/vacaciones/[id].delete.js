import Vacacion from '../../../models/Vacacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

/**
 * DELETE /api/rrhh/vacaciones/:id
 * Solo manager/admin. Útil para limpiar errores; las solicitudes válidas se
 * rechazan en vez de borrarse para mantener la trazabilidad.
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'manager')
  const id = event.context.params.id
  const res = await Vacacion.deleteOne({ _id: id })
  if (!res.deletedCount) throw createError({ statusCode: 404, message: 'No encontrada' })
  return { ok: true }
})
