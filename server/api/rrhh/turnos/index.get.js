import Turno from '../../../models/Turno.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const { orgId, todos } = getQuery(event)
  const filter = { ...orgScopeFilter(user, orgId) }
  if (!todos) filter.activo = true
  return Turno.find(filter).sort({ nombre: 1 }).lean()
})
