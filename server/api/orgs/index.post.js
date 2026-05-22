import { requireDb, newId } from '@/server/utils/db'
import { requireAdmin } from '@/server/utils/requireAuth'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAdmin(event)   // solo admin global puede crear orgs

  const body = await readBody(event)
  if (!body.nombre) throw createError({ statusCode: 400, message: 'Nombre requerido' })

  const org = new Organization({
    _id: body.id || newId('org'),
    ...body,
  })
  await org.save()
  return org.toObject()
})
