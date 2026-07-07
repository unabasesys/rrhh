import Contrato from '../../../models/Contrato.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const query = getQuery(event)
  const { trabajador_id, estado } = query
  const filter = {}
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (estado) filter.estado = estado
  // Scoping multi-tenant: solo contratos de las orgs del usuario
  Object.assign(filter, orgScopeFilter(user, query.orgId))
  return Contrato.find(filter).sort({ creado: -1 }).lean()
})
