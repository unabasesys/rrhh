import Turno from '../../../models/Turno.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)

  let orgId = body.orgId || null
  if (user.rol !== 'admin') {
    const list = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
    if (!orgId) orgId = list[0] || null
    requireOrgAccess(user, orgId)
  }

  const doc = new Turno({ ...body, orgId, _id: body._id || newId('turno'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
