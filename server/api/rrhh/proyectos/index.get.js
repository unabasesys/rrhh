import Proyecto from '../../../models/Proyecto.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const query = getQuery(event)
  const filter = {}
  // Scoping multi-tenant: solo proyectos de las orgs del usuario
  Object.assign(filter, orgScopeFilter(user, query.orgId))
  if (!query.todos) filter.activo = true
  return Proyecto.find(filter).sort({ createdAt: 1 }).lean()
})
