import Marcacion from '../../../models/Marcacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  // Validar acceso al orgId de la marcación existente
  const existing = await Marcacion.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Marcación no encontrada' })
  requireOrgAccess(user, existing.orgId)

  // No permitir cambiar orgId vía PUT (evita escape de scope)
  const { orgId: _ignore, ...safeBody } = body
  const doc = await Marcacion.findByIdAndUpdate(id, safeBody, { new: true }).lean()
  return doc
})
