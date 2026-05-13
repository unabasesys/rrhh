import Contrato from '../../../models/Contrato.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const { trabajador_id, estado } = getQuery(event)
  const filter = {}
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (estado) filter.estado = estado
  return Contrato.find(filter).sort({ creado: -1 }).lean()
})
