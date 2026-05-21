import Linea from '../../../models/Linea.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)
  const doc  = await Linea.findByIdAndUpdate(id, body, { new: true }).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Línea no encontrada' })
  return doc
})
