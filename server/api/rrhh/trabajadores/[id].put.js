import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const existing = await Trabajador.findById(id).lean()
  if (!existing) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  requireOrgAccess(user, existing.orgId)

  // Evitar tenant hopping: no permitir reescribir orgId ni _id desde el body
  const { orgId: _o, _id: _i, ...safe } = body

  const doc = await Trabajador.findByIdAndUpdate(
    id,
    { ...safe, actualizado: new Date() },
    { new: true, runValidators: true }
  ).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  return doc
})
