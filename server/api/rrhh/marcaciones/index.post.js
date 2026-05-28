import Marcacion from '../../../models/Marcacion.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const body = await readBody(event)

  // Determinar orgId final
  // - admin: respeta el body.orgId o lo deja null
  // - manager/viewer: fuerza a una de sus orgs (si body.orgId difiere, valida acceso)
  let orgId = body.orgId || null
  if (user.rol !== 'admin') {
    const list = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
    if (!orgId) orgId = list[0] || null
    requireOrgAccess(user, orgId)
  }

  const doc = new Marcacion({ ...body, orgId, _id: body._id || newId('marc'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
