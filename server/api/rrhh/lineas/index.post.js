import Linea from '../../../models/Linea.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Linea({ _id: body.id || newId('lin'), ...body })
  await doc.save()
  return doc.toObject()
})
