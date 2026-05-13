import Contrato from '../../../models/Contrato.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  await Contrato.findByIdAndDelete(id)
  return { ok: true }
})
