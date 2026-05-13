import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const doc = await Trabajador.findByIdAndUpdate(
    id,
    { ...body, actualizado: new Date() },
    { new: true, runValidators: true }
  ).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  return doc
})
