import Linea from '../../../models/Linea.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const query = getQuery(event)
  const filter = {}
  if (query.proyectoId) filter.proyectoId = query.proyectoId
  if (query.orgId) filter.orgId = query.orgId
  if (!query.todos) filter.activo = true
  return Linea.find(filter).sort({ codigo: 1 }).lean()
})
