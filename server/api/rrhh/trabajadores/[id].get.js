import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  const doc = await Trabajador.findById(id).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  return doc
})
