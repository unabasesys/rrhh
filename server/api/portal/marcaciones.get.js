/**
 * GET /api/portal/marcaciones?anio=YYYY&mes=MM
 * Devuelve las marcaciones del trabajador autenticado en el mes.
 * Default: mes y año actual.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Marcacion from '../../models/Marcacion.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }

  const q = getQuery(event)
  const now = new Date()
  const anio = Number(q.anio) || now.getFullYear()
  const mes  = Number(q.mes)  || (now.getMonth() + 1)

  const mm = String(mes).padStart(2, '0')
  const start = `${anio}-${mm}-01`
  // último día del mes
  const last = new Date(anio, mes, 0).getDate()
  const end  = `${anio}-${mm}-${String(last).padStart(2, '0')}`

  const marcs = await Marcacion
    .find({
      trabajador_id: me.trabajador_id,
      fecha: { $gte: start, $lte: end },
    })
    .sort({ fecha: -1 })
    .lean()

  return { ok: true, marcaciones: marcs, periodo: { anio, mes } }
})
