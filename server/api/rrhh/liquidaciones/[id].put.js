import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)

  const existing = await Liquidacion.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Liquidación no encontrada' })
  requireOrgAccess(user, existing.orgId)

  // Solo admin puede cambiar orgId (reasignación de org)
  if (body.orgId && body.orgId !== existing.orgId && user.rol !== 'admin') {
    throw createError({ statusCode: 403, message: 'Solo admin puede reasignar orgId' })
  }
  // Si el body trae nuevo orgId, validar que el admin tenga acceso al destino
  if (body.orgId && body.orgId !== existing.orgId) {
    requireOrgAccess(user, body.orgId)
  }

  const doc = await Liquidacion.findByIdAndUpdate(id, body, { new: true }).lean()
  return doc
})
