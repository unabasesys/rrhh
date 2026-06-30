import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const { trabajador_id, mes, anio, orgId } = getQuery(event)

  const filter = {}
  if (trabajador_id) filter.trabajador_id = trabajador_id
  if (mes)  filter.mes  = Number(mes)
  if (anio) filter.anio = Number(anio)

  // Multi-tenant: admin global ve todo (con query opcional ?orgId);
  // manager y viewer solo sus orgs.
  if (user.rol !== 'admin') {
    const list = Array.isArray(user.orgIds) && user.orgIds.length
      ? user.orgIds
      : (user.orgId ? [user.orgId] : [])
    if (!list.length) return []
    filter.orgId = { $in: list }
  } else if (orgId) {
    filter.orgId = orgId
  }

  return Liquidacion.find(filter).sort({ anio: -1, mes: -1 }).lean()
})
