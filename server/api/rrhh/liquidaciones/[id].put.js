import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const doc = await Liquidacion.findByIdAndUpdate(id, body, { new: true }).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Liquidación no encontrada' })
  return doc
})
