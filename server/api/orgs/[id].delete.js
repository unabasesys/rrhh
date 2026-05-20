import { requireDb } from '@/server/utils/db'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  await Organization.findByIdAndDelete(id)
  return { ok: true }
})
