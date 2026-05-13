import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const query = getQuery(event)
  const filter = {}
  if (query.estado) filter.estado = query.estado
  const trabajadores = await Trabajador.find(filter).sort({ creado: -1 }).lean()
  return trabajadores
})
