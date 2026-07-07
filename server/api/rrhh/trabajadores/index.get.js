import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const query = getQuery(event)
  const filter = {}

  // Filtrar por estado si se indica
  if (query.estado) filter.estado = query.estado

  // Scoping multi-tenant: solo devuelve trabajadores de las orgs del usuario.
  // (admin sin orgId concreto ve todo; manager/viewer se limitan a sus orgs)
  Object.assign(filter, orgScopeFilter(user, query.orgId))

  const trabajadores = await Trabajador.find(filter).sort({ creado: -1 }).lean()
  return trabajadores
})
