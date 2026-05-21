import Proyecto from '../../../models/Proyecto.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Proyecto({ _id: body.id || newId('proy'), ...body })
  await doc.save()
  return doc.toObject()
})
