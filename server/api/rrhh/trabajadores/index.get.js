import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const query = getQuery(event)
  const filter = {}

  // Filtrar por estado si se indica
  if (query.estado) filter.estado = query.estado

  // Filtrar por orgId:
  // - Si se pasa orgId concreto → solo trabajadores de esa org
  // - Si no se pasa orgId → super-admin viendo todo (sin filtro de org)
  if (query.orgId) {
    filter.orgId = query.orgId
  }

  const trabajadores = await Trabajador.find(filter).sort({ creado: -1 }).lean()
  return trabajadores
})
