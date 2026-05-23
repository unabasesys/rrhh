/**
 * GET /api/portal/liquidaciones
 * Devuelve las liquidaciones del trabajador autenticado.
 * Solo viewers con trabajador_id pueden usarlo.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Liquidacion from '../../models/Liquidacion.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }

  const liqs = await Liquidacion
    .find({ trabajador_id: me.trabajador_id })
    .sort({ anio: -1, mes: -1 })
    .lean()

  return { ok: true, liquidaciones: liqs }
})
