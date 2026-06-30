import Anticipo from '../../../models/Anticipo.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'manager')
  const id = event.context.params.id
  const res = await Anticipo.deleteOne({ _id: id })
  if (!res.deletedCount) throw createError({ statusCode: 404, message: 'Anticipo no encontrado' })
  return { ok: true }
})
