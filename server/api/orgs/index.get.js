import { requireDb } from '@/server/utils/db'
import { requireAuth } from '@/server/utils/requireAuth'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)

  // admin: ve todas las orgs.
  // manager: solo las orgs en su orgIds.
  // viewer: solo su org (1).
  const filter = {}
  if (user.rol !== 'admin') {
    const list = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
    if (!list.length) return []
    filter._id = { $in: list }
  }
  const orgs = await Organization.find(filter).sort({ createdAt: 1 }).lean()
  return orgs
})
