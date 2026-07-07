import Contrato from '../../../models/Contrato.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)
  // Validar que el usuario tenga acceso a la org destino
  requireOrgAccess(user, body.orgId)
  const doc = new Contrato({ ...body, _id: body._id || newId('c'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
