import Linea from '../../../models/Linea.js'
import Proyecto from '../../../models/Proyecto.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const query = getQuery(event)
  const filter = {}
  if (query.proyectoId) {
    filter.proyectoId = query.proyectoId
    // Validar que el proyecto pertenezca a una org accesible por el usuario
    const proyecto = await Proyecto.findById(query.proyectoId).lean()
    if (proyecto) requireOrgAccess(user, proyecto.orgId)
  }
  // Scoping multi-tenant por orgId propio de la línea
  Object.assign(filter, orgScopeFilter(user, query.orgId))
  if (!query.todos) filter.activo = true
  return Linea.find(filter).sort({ codigo: 1 }).lean()
})
