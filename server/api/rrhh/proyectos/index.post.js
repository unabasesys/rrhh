import Proyecto from '../../../models/Proyecto.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)
  // Validar que el usuario tenga acceso a la org destino
  requireOrgAccess(user, body.orgId)
  const doc = new Proyecto({ _id: body.id || newId('proy'), ...body })
  await doc.save()
  return doc.toObject()
})
