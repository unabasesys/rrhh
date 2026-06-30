import { requireDb, newId } from '@/server/utils/db'
import { requireAuth } from '@/server/utils/requireAuth'
import Organization from '@/server/models/Organization'
import User from '@/server/models/User'

/**
 * POST /api/orgs
 * Crea una nueva organización. Cualquier usuario autenticado (admin o
 * manager) puede crearla; al crearla queda automáticamente asignada a su
 * cuenta como una de sus orgs administradas.
 *
 * Body: { nombre, rut?, direccion?, comuna?, ciudad?, representanteLegal?, ... }
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)

  const body = await readBody(event)
  if (!body?.nombre) throw createError({ statusCode: 400, message: 'Nombre requerido' })

  const org = new Organization({
    _id: body.id || newId('org'),
    ...body,
    activo: true,
  })
  await org.save()

  // Asignar al usuario creador: pasa a su lista de orgs administradas
  // y como org activa primaria. Los admin globales (orgIds: []) NO se
  // tocan — mantienen acceso a todas las orgs vía rol admin.
  if (me.rol !== 'admin') {
    const user = await User.findById(me._id)
    if (user) {
      const orgIds = Array.isArray(user.orgIds) ? user.orgIds : []
      if (!orgIds.includes(org._id)) orgIds.push(org._id)
      user.orgIds = orgIds
      if (!user.orgId) user.orgId = org._id
      await user.save()
    }
  }

  return org.toObject()
})
