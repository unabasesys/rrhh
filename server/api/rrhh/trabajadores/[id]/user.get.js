/**
 * GET /api/rrhh/trabajadores/:id/user
 *
 * Devuelve la cuenta de acceso (User) vinculada a este trabajador, si existe.
 * Útil para mostrar "Cuenta vinculada: juan@empresa.cl" o "Crear cuenta de acceso".
 *
 * Permisos: admin global o manager con acceso a la org del trabajador.
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

  const user = await User.findOne(
    { trabajador_id: id },
    { passwordHash: 0, token: 0, tokenExpires: 0 }
  ).lean()

  return { ok: true, user: user || null }
})
