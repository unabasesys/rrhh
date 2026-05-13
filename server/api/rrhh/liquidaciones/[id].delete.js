import Liquidacion from '../../../models/Liquidacion.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  await Liquidacion.findByIdAndDelete(id)
  return { ok: true }
})
