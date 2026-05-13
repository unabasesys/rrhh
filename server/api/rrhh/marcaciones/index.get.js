import Marcacion from '../../../models/Marcacion.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const { trabajador_id, fecha_desde, fecha_hasta } = getQuery(event)
  const filter = {}
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (fecha_desde || fecha_hasta) {
    filter.fecha = {}
    if (fecha_desde) filter.fecha.$gte = fecha_desde
    if (fecha_hasta) filter.fecha.$lte = fecha_hasta
  }
  return Marcacion.find(filter).sort({ fecha: -1 }).lean()
})
