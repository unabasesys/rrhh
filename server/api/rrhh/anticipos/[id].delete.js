import Anticipo from '../../../models/Anticipo.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = event.context.params.id

  const anticipo = await Anticipo.findById(id).lean()
  if (!anticipo) throw createError({ statusCode: 404, message: 'Anticipo no encontrado' })
  requireOrgAccess(user, anticipo.orgId)

  await Anticipo.deleteOne({ _id: id })
  return { ok: true }
})
