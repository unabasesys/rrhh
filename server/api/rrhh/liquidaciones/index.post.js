import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Liquidacion({ ...body, _id: body._id || newId('liq'), creado: new Date() })
  await doc.save()
  return doc.toObject()
})
