import Proyecto from '../../../models/Proyecto.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const query = getQuery(event)
  const filter = {}
  if (query.orgId) filter.orgId = query.orgId
  if (!query.todos) filter.activo = true
  return Proyecto.find(filter).sort({ createdAt: 1 }).lean()
})
