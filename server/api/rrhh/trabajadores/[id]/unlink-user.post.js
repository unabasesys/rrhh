/**
 * POST /api/rrhh/trabajadores/:id/unlink-user
 *
 * Desvincula la cuenta de acceso del trabajador (rompe la relación, NO borra
 * el usuario). El usuario queda activo pero sin trabajador asociado.
 *
 * Permisos: admin global, o manager con acceso a la org del trabajador.
 */
import { requireDb } from '../../../../utils/db.js'
import { requireManager, requireOrgAccess } from '../../../../utils/requireAuth.js'
import Trabajador from '../../../../models/Trabajador.js'
import User from '../../../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireManager(event)

  const id = getRouterParam(event, 'id')
  const trab = await Trabajador.findById(id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  requireOrgAccess(me, trab.orgId)

  const user = await User.findOne({ trabajador_id: id })
  if (!user) {
    return { ok: true, message: 'No había cuenta vinculada' }
  }
  user.trabajador_id = null
  await user.save()
  return { ok: true, message: 'Cuenta desvinculada' }
})
