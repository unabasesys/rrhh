import { requireDb } from '@/server/utils/db'
import { requireAuth, requireOrgAccess } from '@/server/utils/requireAuth'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')   // admin o manager
  const id   = getRouterParam(event, 'id')
  // manager solo puede editar orgs en su orgIds
  requireOrgAccess(user, id)

  const body = await readBody(event)
  const org = await Organization.findByIdAndUpdate(id, body, { new: true }).lean()
  if (!org) throw createError({ statusCode: 404, message: 'Organización no encontrada' })
  return org
})
