import Marcacion from '../../../models/Marcacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const { trabajador_id, fecha_desde, fecha_hasta, orgId } = getQuery(event)

  // Scope por org del usuario (admin sin filtro, manager/viewer por sus orgs)
  const filter = { ...orgScopeFilter(user, orgId) }
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (fecha_desde || fecha_hasta) {
    filter.fecha = {}
    if (fecha_desde) filter.fecha.$gte = fecha_desde
    if (fecha_hasta) filter.fecha.$lte = fecha_hasta
  }
  return Marcacion.find(filter).sort({ fecha: -1 }).lean()
})
