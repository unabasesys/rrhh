import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const query = getQuery(event)
  const filter = {}

  // Filtrar por estado si se indica
  if (query.estado) filter.estado = query.estado

  // Filtrar por orgId:
  // - Si se pasa orgId concreto → mostrar solo esa org + huérfanos (orgId null) para
  //   compatibilidad con registros creados antes de tener org asignada.
  // - Si no se pasa orgId → super-admin viendo todo (sin filtro)
  if (query.orgId) {
    filter.$or = [
      { orgId: query.orgId },
      { orgId: null },
      { orgId: { $exists: false } },
    ]
  }

  const trabajadores = await Trabajador.find(filter).sort({ creado: -1 }).lean()
  return trabajadores
})
