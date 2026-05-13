import Turno from '../../../models/Turno.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Turno({ ...body, _id: body._id || newId('turno'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
