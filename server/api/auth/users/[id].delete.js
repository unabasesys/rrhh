/**
 * DELETE /api/auth/users/:id
 *   - admin   → puede eliminar a cualquiera (excepto a sí mismo y al último admin).
 *   - manager → solo a usuarios no-admin dentro de sus orgIds.
 */
import { requireDb } from '../../../utils/db.js'
import { requireManager } from '../../../utils/requireAuth.js'
import User from '../../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireManager(event)

  const id   = getRouterParam(event, 'id')
  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, message: 'Usuario no encontrado' })

  // No puedes eliminarte a ti mismo
  if (user._id === me._id) {
    throw createError({ statusCode: 400, message: 'No puedes eliminarte a ti mismo' })
  }

  if (me.rol === 'manager') {
    if (user.rol === 'admin') {
      throw createError({ statusCode: 403, message: 'No puedes eliminar a un administrador' })
    }
    const myOrgs = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    const userOrgs = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
    const overlap = userOrgs.some(o => myOrgs.includes(o))
    if (!overlap) {
      throw createError({ statusCode: 403, message: 'Sin acceso a este usuario' })
    }
  }

  // Proteger al último admin
  if (user.rol === 'admin') {
    const adminCount = await User.countDocuments({ rol: 'admin' })
    if (adminCount <= 1) {
      throw createError({ statusCode: 400, message: 'No puedes eliminar al único administrador' })
    }
  }

  await User.deleteOne({ _id: id })
  return { ok: true }
})
