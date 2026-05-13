import Contrato from '../../../models/Contrato.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Contrato({ ...body, _id: body._id || newId('c'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
