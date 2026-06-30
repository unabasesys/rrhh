import Vacacion from '../../../models/Vacacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

/**
 * GET /api/rrhh/vacaciones?trabajador_id=...&estado=...&orgId=...
 * Lista solicitudes — filtra por orgId del usuario (admin global ve todo).
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const { trabajador_id, estado, orgId } = getQuery(event)

  const filter = {}
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (estado)        filter.estado        = estado

  // Multi-tenant: admin ve todo, los demás solo su org
  if (user.rol !== 'admin') {
    const orgIds = Array.isArray(user.orgIds) && user.orgIds.length ? user.orgIds : [user.orgId].filter(Boolean)
    filter.orgId = { $in: orgIds }
  } else if (orgId) {
    filter.orgId = orgId
  }

  return Vacacion.find(filter).sort({ fecha_inicio: -1 }).lean()
})
