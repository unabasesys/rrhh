import Anticipo from '../../../models/Anticipo.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const { mes, anio, orgId, trabajador_id } = getQuery(event)

  const filter = {}
  if (mes)           filter.mes  = Number(mes)
  if (anio)          filter.anio = Number(anio)
  if (trabajador_id) filter.trabajador_id = trabajador_id

  if (user.rol !== 'admin') {
    const list = Array.isArray(user.orgIds) && user.orgIds.length ? user.orgIds : [user.orgId].filter(Boolean)
    filter.orgId = { $in: list }
  } else if (orgId) {
    filter.orgId = orgId
  }

  return Anticipo.find(filter).sort({ fecha: -1, creado: -1 }).lean()
})
