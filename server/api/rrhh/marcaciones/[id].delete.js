import Marcacion from '../../../models/Marcacion.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  await Marcacion.findByIdAndDelete(id)
  return { ok: true }
})
