import Marcacion from '../../../models/Marcacion.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Marcacion({ ...body, _id: body._id || newId('marc'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
