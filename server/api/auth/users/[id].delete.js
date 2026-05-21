/**
 * DELETE /api/auth/users/:id
 * Eliminar usuario — requiere admin. No puedes eliminar al último admin.
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import User from '../../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event, 'admin')

  const id   = getRouterParam(event, 'id')
  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, message: 'Usuario no encontrado' })

  // No puedes eliminarte a ti mismo
  if (user._id === me._id) {
    throw createError({ statusCode: 400, message: 'No puedes eliminarte a ti mismo' })
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
