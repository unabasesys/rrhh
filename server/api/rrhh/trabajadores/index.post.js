import Trabajador from '../../../models/Trabajador.js'
import { requireDb, newId } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const doc = new Trabajador({
    ...body,
    _id: body._id || newId('w'),
    creado: new Date(),
    actualizado: new Date(),
  })
  await doc.save()
  return doc.toObject()
})
