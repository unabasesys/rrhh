import { requireDb } from '@/server/utils/db'
import { requireAdmin } from '@/server/utils/requireAuth'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAdmin(event)   // solo admin global puede eliminar orgs
  const id = getRouterParam(event, 'id')
  await Organization.findByIdAndDelete(id)
  return { ok: true }
})
