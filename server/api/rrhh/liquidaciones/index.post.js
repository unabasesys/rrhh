import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const body = await readBody(event)
  const doc = new Liquidacion({
    ...body,
    _id:               body._id || newId('liq'),
    creado:            new Date(),
    creado_por_id:     user._id || user.id || null,
    creado_por_nombre: user.nombre || user.email || null,
  })
  await doc.save()
  return doc.toObject()
})
