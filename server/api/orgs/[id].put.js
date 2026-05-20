import { requireDb } from '@/server/utils/db'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)

  const org = await Organization.findByIdAndUpdate(id, body, { new: true }).lean()
  if (!org) throw createError({ statusCode: 404, message: 'Organización no encontrada' })
  return org
})
