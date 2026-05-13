import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const { trabajador_id, mes, anio } = getQuery(event)
  const filter = {}
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (mes)  filter.mes  = Number(mes)
  if (anio) filter.anio = Number(anio)
  return Liquidacion.find(filter).sort({ anio: -1, mes: -1 }).lean()
})
